import axios from "axios";
import { logger } from "utils/logger";

const baseURL = `${process.env.REACT_APP_BACKEND_URL}`;

const createAxiosInstance = (baseUrl) => {
  const instance = axios.create({
    baseURL: baseUrl, // Replace with your API's base URL
    timeout: 60000, // Set a timeout limit
    headers: {
      "Content-Type": "application/json",
      // Add any custom headers here
    },
  });

  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      const errorMessage = error.response?.data?.message || error.message;
      const statusCode = error.response?.status;
      
      logger.error(`[API Call Failed] ${error.config?.url}`, {
        status: statusCode,
        message: errorMessage,
        payload: error.config?.data
      });

      if (statusCode === 429) {
        if (!window._isAlerting429) {
          window._isAlerting429 = true;
          alert("มีผู้ใช้งานเข้าใช้มากเกินไป กรุณาลองใหม่ในภายหลัง");
          setTimeout(() => { window._isAlerting429 = false; }, 2000);
        }
      }

      return Promise.reject(error);
    }
  );

  return instance;
};

export const apiAxiosInstance = createAxiosInstance(baseURL);

export const post = async (url, data, config, axiosInstance, token) => {
  try {
    if (token) {
      axiosInstance.defaults.headers.common["Authorization"] = token;
    }
    const response = await axiosInstance.post(url, data, config);
    return response.data;
  } catch (error) {
    logger.error("API POST Error:", error);
    throw error;
  }
};

export const get = async (url, params, config, axiosInstance, token) => {
  try {
    if (token) {
      axiosInstance.defaults.headers.common["Authorization"] = token;
    }
    const response = await axiosInstance.get(url, {
      ...config,
      params,
    });
    return response.data;
  } catch (error) {
    logger.error("API GET Error:", error);
    throw error;
  }
};

export const postGeneral = (url, data, token) => {
  const headers = {
    "Content-Type": "application/json",
  };

  if (token) {
    axios.defaults.headers.common["Authorization"] = token;
  }

  return axios.post(url, data, {
    headers: headers,
  });
};

export const getGeneral = (url, params, token) => {
  const headers = {
    "Content-Type": "application/json",
  };

  if (token) {
    axios.defaults.headers.common["Authorization"] = token;
  }

  return axios.get(url, params, {
    headers: headers,
  });
};

export const getPdf = async (url, params) => {
  return await axios.get(url, params, { responseType: "blob" });
};
