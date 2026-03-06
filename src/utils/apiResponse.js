export default function apiResponse(res, status, message, data = null) {
  return res.status(status).json({
    success: status < 400,
    message,
    data,
  });
}


