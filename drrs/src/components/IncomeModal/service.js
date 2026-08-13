import { updateIncome } from "api/verify";

export const updateIncomeService = async (payload) => {
    try {
        const response = await updateIncome(payload);
        return response;
    } catch (error) {
        console.error("Service Error (updateIncomeService):", error);
        throw error;
    }
};
