export interface UserDto {
  id: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface JwtTokenPayload {
  userId: string;
  email: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: UserDto;
  tokens: AuthTokens;
}
