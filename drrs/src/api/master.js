import { apiAxiosInstance } from "./handler";

export const checkCloseSystem = async (payload) => {
    try {
        const response = await apiAxiosInstance.post("/api/checkCloseSystem", payload);
        return response.data;
    } catch (error) {
        console.error(error);
        throw error;
    }
};
