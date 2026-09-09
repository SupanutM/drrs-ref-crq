jest.mock('../services/util/checkCloseSystem', () => ({
    checkCloseSystemService: jest.fn(),
}));
jest.mock('../utils/logger', () => ({
    child: () => ({ error: jest.fn(), info: jest.fn(), warn: jest.fn() }),
}));

const { checkCloseSystemService } = require('../services/util/checkCloseSystem');
const { checkSystemOpenMiddleware } = require('./checkSystemOpenMiddleware');

function mockRes() {
    return {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
    };
}

describe('checkSystemOpenMiddleware', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('เรียก next() เมื่อระบบเปิดอยู่ (status_flag = true)', async () => {
        checkCloseSystemService.mockResolvedValue({
            status: true,
            data: [{ status_flag: true, appVersion: '1.0.0' }],
        });

        const req = {};
        const res = mockRes();
        const next = jest.fn();

        await checkSystemOpenMiddleware(req, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(res.status).not.toHaveBeenCalled();
    });

    test('ตอบ 503 เมื่อระบบปิดอยู่ (status_flag = false)', async () => {
        checkCloseSystemService.mockResolvedValue({
            status: true,
            data: [{ status_flag: false, appVersion: '1.0.0' }],
        });

        const req = {};
        const res = mockRes();
        const next = jest.fn();

        await checkSystemOpenMiddleware(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(503);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ status_flag: false })
        );
    });

    test('ตอบ 503 เมื่อ data เป็น array ว่าง (ไม่มี config ของ channel นี้)', async () => {
        checkCloseSystemService.mockResolvedValue({
            status: true,
            data: [],
        });

        const req = {};
        const res = mockRes();
        const next = jest.fn();

        await checkSystemOpenMiddleware(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(503);
    });

    test('ตอบ 503 เมื่อ service throw error (DB error) — fail-safe ปิดระบบ', async () => {
        checkCloseSystemService.mockRejectedValue(new Error('DB connection lost'));

        const req = {};
        const res = mockRes();
        const next = jest.fn();

        await checkSystemOpenMiddleware(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(503);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({ status_flag: false })
        );
    });

    test('ตอบ 503 เมื่อ result.status เป็น false', async () => {
        checkCloseSystemService.mockResolvedValue({
            status: false,
            data: [{ status_flag: true, appVersion: '1.0.0' }],
        });

        const req = {};
        const res = mockRes();
        const next = jest.fn();

        await checkSystemOpenMiddleware(req, res, next);

        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(503);
    });
});
