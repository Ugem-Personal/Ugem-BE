export interface RegisterInput {
  email: string;
  password: string;
  phoneNumber?: string;
  fullName: string;
  avatarUrl?: string;
  role: "Customer" | "Merchant";
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface RefreshTokenInput {
  accessToken?: string;
  refreshToken: string;
}

export interface JwtPayload {
  UserId: string;
  Email: string;
  Name: string;
  Role: string;
  CustomerId: string | null;
  MerchantId: string | null;
  AvatarUrl: string | null;
}

export interface GoogleLoginInput {
  idToken: string;
}

export interface ForgotPasswordInput {
  email: string;
}

export interface ResetPasswordInput {
  email: string;
  token: string;
  newPassword: string;
  confirmNewPassword: string;
}
