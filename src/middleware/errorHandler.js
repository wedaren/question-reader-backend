/**
 * 全局错误处理中间件
 */
const errorHandler = (err, req, res, next) => {
  console.error('错误详情:', err);

  // 默认错误信息
  let status = 500;
  let errorResponse = {
    error: {
      code: 'INTERNAL_ERROR',
      message: '服务器内部错误'
    }
  };

  // 根据错误类型返回不同的响应
  if (err.name === 'ValidationError') {
    status = 400;
    errorResponse.error = {
      code: 'VALIDATION_ERROR',
      message: '请求参数验证失败'
    };
  } else if (err.name === 'CastError') {
    status = 400;
    errorResponse.error = {
      code: 'INVALID_PARAMETER',
      message: '无效的参数格式'
    };
  } else if (err.status) {
    // 自定义错误状态
    status = err.status;
    if (err.code && err.message) {
      errorResponse.error = {
        code: err.code,
        message: err.message
      };
    }
  }

  res.status(status).json(errorResponse);
};

module.exports = errorHandler;
