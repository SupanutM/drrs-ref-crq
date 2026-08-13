const isDev = process.env.REACT_ENV === 'development';

export const logger = {
    info: (message, data) => {
        if (isDev) {
            console.log(`[INFO] ${message}`, data || '');
        }
    },
    warn: (message, data) => {
        if (isDev) {
            console.warn(`[WARN] ${message}`, data || '');
        }
    },
    error: (message, error) => {
        if (isDev) {
            console.error(`[ERROR] ${message}`, error || '');
        } else {
            // [TODO]: Production Error Tracking Integration (e.g. Sentry, Datadog)
            // Example: Sentry.captureException(error, { extra: { message } });
        }
    }
};
