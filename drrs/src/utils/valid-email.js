// import validator from 'validator';

export function validEmail(value) {
  // return !validator.isEmail(value) ? true : false;
  const pattern = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
  return !pattern.test(value) ? true : false;
}

export default validEmail;
