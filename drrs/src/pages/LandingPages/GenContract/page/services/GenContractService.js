import { generatePdfBase64 } from "api/register";
import { logger } from "utils/logger";

export const generatePDF = async (payload) => {
    try {
        const response = await generatePdfBase64(payload);
        return response;
    } catch (error) {
        logger.error("Service Error (generatePDF):", error);
        throw error;
    }
};