jest.mock('../../config/database', () => ({
    AppDataSource: { transaction: jest.fn() },
}));
jest.mock('../../utils/logger', () => ({
    child: () => ({ error: jest.fn(), info: jest.fn(), warn: jest.fn() }),
}));

const { AppDataSource } = require('../../config/database');
const { importCustomer } = require('./targetDataImportService');

/**
 * เทสยืนยันว่า importCustomer (upsert ตาม CIF_NO — แก้บั๊ก 2026-09-15) ยัง "soft-delete" ลูกค้าที่
 * หายไปจากไฟล์รอบนี้ได้จริง ไม่ใช่ว่าเปลี่ยนเป็น upsert แล้วจะไม่เกิด soft-delete อีกเลย
 *
 * จำลอง repository ด้วย mock ธรรมดา (ไม่ต่อ DB จริง) ครอบคลุม 3 เคส:
 *   1. CIF ตรงกับของเก่า -> UPDATE (ไม่ insert ไม่ delete)
 *   2. CIF ใหม่ไม่เคยมี -> INSERT
 *   3. CIF เดิมหายไปจากไฟล์ -> soft-delete (status '1' -> '0') ยืนยันว่า "ยังเกิดได้จริง"
 *   4. CIF เดิมหายไปจากไฟล์ แต่มีบัญชีส่ง CBS สำเร็จแล้ว -> ห้าม soft-delete
 */
describe('importCustomer (upsert ตาม CIF_NO)', () => {
    let cusRepo;
    let accRepo;
    let stepRepo;

    beforeEach(() => {
        jest.clearAllMocks();

        cusRepo = {
            find: jest.fn(),
            update: jest.fn().mockResolvedValue({}),
            insert: jest.fn().mockResolvedValue({}),
            createQueryBuilder: jest.fn(),
        };
        accRepo = {
            find: jest.fn().mockResolvedValue([]),
        };
        stepRepo = {
            createQueryBuilder: jest.fn(),
        };

        // ไม่มีบัญชีที่ส่ง CBS สำเร็จ (default) — ทดสอบ override เฉพาะเคสที่ต้องการ
        stepRepo.createQueryBuilder.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            getRawMany: jest.fn().mockResolvedValue([]),
        });

        const manager = {
            query: jest.fn().mockResolvedValue(undefined),
            getRepository: jest.fn((entity) => {
                // EntitySchema (TypeORM) เก็บชื่อตารางไว้ที่ entity.options.name ไม่ใช่ entity.name ตรงๆ
                const tableName = entity && entity.options && entity.options.name;
                if (tableName === 'tbl_cus_target') return cusRepo;
                if (tableName === 'tbl_account_cus_target') return accRepo;
                if (tableName === 'tbl_settings_step') return stepRepo;
                return cusRepo;
            }),
        };

        AppDataSource.transaction.mockImplementation(async (cb) => cb(manager));
    });

    // helper: mock createQueryBuilder ของ cusRepo สำหรับ soft-delete update chain
    const mockDeleteQueryBuilder = () => {
        const execute = jest.fn().mockResolvedValue({ affected: 1 });
        const qb = {
            update: jest.fn().mockReturnThis(),
            set: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            execute,
        };
        cusRepo.createQueryBuilder.mockReturnValue(qb);
        return { qb, execute };
    };

    test('CIF เดิมหายไปจากไฟล์รอบนี้ -> ต้อง soft-delete จริง (ไม่ใช่ว่า upsert แล้วไม่ลบเลย)', async () => {
        // DB มีลูกค้า active 2 คน: CIF=A (id=1), CIF=B (id=2)
        cusRepo.find.mockResolvedValue([
            { id: 1, cifNo: 'A', status: '1' },
            { id: 2, cifNo: 'B', status: '1' },
        ]);
        const { qb, execute } = mockDeleteQueryBuilder();

        const buffer = Buffer.from('A|1234567890123|Somchai|Jaidee|1234|1\n');
        const result = await importCustomer(buffer, 'tester');

        expect(result.success).toBe(true);
        // B หายไปจากไฟล์ -> ต้องถูก soft-delete
        expect(qb.andWhere).toHaveBeenCalledWith('id IN (:...idsToDelete)', { idsToDelete: [2] });
        expect(execute).toHaveBeenCalledTimes(1);
        expect(result.data.deleted).toBe(1);
        // A ตรงกับไฟล์ -> update ไม่ insert
        expect(cusRepo.update).toHaveBeenCalledWith(1, expect.objectContaining({ citizenId: '1234567890123' }));
        expect(cusRepo.insert).not.toHaveBeenCalled();
    });

    test('CIF ใหม่ที่ไม่เคยมีในระบบ -> INSERT แถวใหม่ ไม่ update ไม่ delete', async () => {
        cusRepo.find.mockResolvedValue([]); // ยังไม่มีลูกค้า active เลย

        const buffer = Buffer.from('NEW01|1234567890123|Somchai|Jaidee|1234|1\n');
        const result = await importCustomer(buffer, 'tester');

        expect(result.success).toBe(true);
        expect(cusRepo.insert).toHaveBeenCalledTimes(1);
        expect(cusRepo.update).not.toHaveBeenCalled();
        expect(result.data.inserted).toBe(1);
        expect(result.data.deleted).toBe(0);
    });

    test('CIF ตรงกับของเก่า -> UPDATE คง id เดิม ไม่สร้างแถวใหม่ (แก้บั๊ก cus_target_id เปลี่ยนทุกรอบ)', async () => {
        cusRepo.find.mockResolvedValue([{ id: 99, cifNo: 'SAME', status: '1' }]);

        const buffer = Buffer.from('SAME|1234567890123|Somchai|Jaidee|1234|1\n');
        const result = await importCustomer(buffer, 'tester');

        expect(cusRepo.update).toHaveBeenCalledWith(99, expect.any(Object));
        expect(cusRepo.insert).not.toHaveBeenCalled();
        expect(result.data.updated).toBe(1);
        expect(result.data.inserted).toBe(0);
    });

    test('CIF เดิมหายไปจากไฟล์ แต่มีบัญชีส่ง CBS สำเร็จแล้ว -> ห้าม soft-delete', async () => {
        // DB มีลูกค้า active: CIF=A (id=1, ในไฟล์), CIF=PROTECTED (id=2, หายจากไฟล์แต่ต้องกันไว้)
        cusRepo.find.mockResolvedValue([
            { id: 1, cifNo: 'A', status: '1' },
            { id: 2, cifNo: 'PROTECTED', status: '1' },
        ]);
        // บัญชี ACC999 ผูกกับ cusTargetId=2 และส่ง CBS สำเร็จแล้ว
        stepRepo.createQueryBuilder.mockReturnValue({
            select: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            getRawMany: jest.fn().mockResolvedValue([{ accountNo: 'ACC999' }]),
        });
        accRepo.find.mockResolvedValue([{ cusTargetId: 2 }]);
        const { qb, execute } = mockDeleteQueryBuilder();

        const buffer = Buffer.from('A|1234567890123|Somchai|Jaidee|1234|1\n');
        const result = await importCustomer(buffer, 'tester');

        // id=2 (PROTECTED) ต้องไม่ถูก soft-delete แม้หายไปจากไฟล์ เพราะมีบัญชีส่ง CBS สำเร็จแล้ว
        expect(execute).not.toHaveBeenCalled();
        expect(qb.andWhere).not.toHaveBeenCalled();
        expect(result.data.deleted).toBe(0);
    });
});
