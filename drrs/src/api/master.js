import { apiAxiosInstance } from "./handler";

// export const findDebtRepaymentByCode = async (payload) => {
//   try {
//     const result = await post(
//       "/regisEarthQuake/findDebtRepaymentByCode",
//       payload,
//       undefined,
//       apiAxiosInstance,
//       undefined
//     );
//     return result;
//   } catch (error) {
//     console.error(error);
//     throw error;
//   }
// };

// export const findCustTargetByCitizenIdAndCifNo = async (payload) => {
//   try {
//     const result = await post(
//       "/regisEarthQuake/findCustTargetByCitizenIdAndCifNo",
//       payload,
//       undefined,
//       apiAxiosInstance,
//       undefined
//     );
//     return result;
//   } catch (error) {
//     console.error(error);
//     throw error;
//   }
// };

// export const checkCloseSystem = async (payload) => {
//   try {
//     const result = await post("/path", payload, undefined, apiAxiosInstance, undefined);
//     return result;
//   } catch (error) {
//     console.error(error);
//     throw error;
//   }
// };

export const checkCloseSystem = async (payload) => {
    try {
        const response = await apiAxiosInstance.post("/api/checkCloseSystem", payload);
        return response.data;
    } catch (error) {
        console.error(error);
        throw error; 
    }
};

// export const checkTargetHc = async (payload) => {
//   try {
//     const result = await post(
//       "/regisHc/findCustTargetByCitizenId",
//       payload,
//       undefined,
//       apiAxiosInstance,
//       undefined
//     );
//     return result;
//   } catch (error) {
//     console.error(error);
//     throw error;
//   }
// };
