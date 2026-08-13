import { apiAxiosInstance } from "./handler"; 
import { logger } from "utils/logger";

export const saveDebtRestructure = async (payload) => {
    try {
        const response = await apiAxiosInstance.post("/api/debt-restructure", payload);
        return response.data;
    } catch (error) {
        logger.error("Submit Debt Restructure API Error:", error);
        throw error; 
    }
};

export const cancelDebtRestructure = async (payload) => {
    try {
        const response = await apiAxiosInstance.post("/api/cancel-plan", payload);
        return response.data;
    } catch (error) {
        logger.error("Cancel Debt Restructure API Error:", error);
        throw error; 
    }
};

export const generatePdfBase64 = async (payload) => {
    try {
        const response = await apiAxiosInstance.post("/api/generate-pdf", payload);
        return response.data;
    } catch (error) {
        logger.error("generate-pdf Error:", error);
        throw error; 
    }
};

export const generateContractPdf = async (payload) => {
    try {
        const response = await apiAxiosInstance.post("/api/generate-contract", payload, {
            responseType: "blob"
        });
        return response.data;
    } catch (error) {
        logger.error("generate-contract Error:", error);
        throw error;
    }
};

export const fetchContractHtml = async (payload) => {
    try {
        const response = await apiAxiosInstance.post("/api/preview-contract-html", payload);
        return response.data;
    } catch (error) {
        logger.error("preview-contract-html Error:", error);
        throw error;
    }
};