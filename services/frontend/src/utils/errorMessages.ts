// Maps API error codes (from API Design V2) to Vietnamese user-facing messages

const ERROR_MESSAGES: Record<string, string> = {
  AUTH_INVALID_CREDENTIALS: 'Email hoặc mật khẩu không đúng.',
  VALIDATION_ERROR:         'Thông tin không hợp lệ. Vui lòng kiểm tra lại.',
  UNAUTHORIZED:             'Bạn cần đăng nhập để thực hiện thao tác này.',
  TOKEN_EXPIRED:            'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  FORBIDDEN:                'Bạn không có quyền thực hiện thao tác này.',
  TOKEN_REUSED:             'Phát hiện hoạt động bất thường. Vui lòng đăng nhập lại.',
  USER_NOT_FOUND:           'Không tìm thấy người dùng.',
  SONG_NOT_FOUND:           'Không tìm thấy bài hát.',
  ROOM_NOT_FOUND:           'Phòng nghe nhạc không tồn tại hoặc đã kết thúc.',
  NOTIFICATION_NOT_FOUND:   'Không tìm thấy thông báo.',
  IDEMPOTENCY_CONFLICT:     'Yêu cầu này đã được xử lý trước đó.',
  PAYLOAD_TOO_LARGE:        'File vượt quá 50MB. Vui lòng nén lại.',
  ACCOUNT_LOCKED:           'Tài khoản tạm khóa do đăng nhập sai quá 5 lần. Vui lòng thử lại sau.',
  RATE_LIMIT_EXCEEDED:      'Bạn đã thực hiện quá nhiều yêu cầu. Vui lòng chờ một lúc.',
  INTERNAL_ERROR:           'Đã có lỗi xảy ra. Vui lòng thử lại.',
  SERVICE_UNAVAILABLE:      'Dịch vụ tạm thời không khả dụng. Vui lòng thử lại sau.',
};

export function getErrorMessage(code: string | undefined): string {
  if (!code) return ERROR_MESSAGES.INTERNAL_ERROR;
  return ERROR_MESSAGES[code] ?? ERROR_MESSAGES.INTERNAL_ERROR;
}
