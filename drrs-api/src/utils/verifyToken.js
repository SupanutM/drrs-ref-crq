const env = require('../config/env')

function verifyToken(value) {
    return value === `Bearer ${env.authorization}` ? true : false;
}

module.exports = {
    verifyToken,
};
