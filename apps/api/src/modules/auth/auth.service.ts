import {
  prisma,
  hashPassword,
  verifyPassword,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  ConflictError,
  UnauthorizedError,
  NotFoundError,
  RegisterInput,
  LoginInput,
} from '@seekr/shared';
import { AuthResponse, AuthTokens, UserDto } from '@seekr/types';
import { config } from '../../config/index.js';

export class AuthService {
  async register(input: RegisterInput): Promise<AuthResponse> {
    const existing = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (existing) {
      throw new ConflictError('A user with this email address already exists');
    }

    const passwordHash = await hashPassword(input.password);

    const user = await prisma.user.create({
      data: {
        email: input.email,
        passwordHash,
      },
    });

    const tokens = this.generateTokens({
      userId: user.id,
      email: user.email,
    });

    return {
      user: this.toUserDto(user),
      tokens,
    };
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const user = await prisma.user.findUnique({
      where: { email: input.email },
    });

    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const isValid = await verifyPassword(user.passwordHash, input.password);
    if (!isValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    const tokens = this.generateTokens({
      userId: user.id,
      email: user.email,
    });

    return {
      user: this.toUserDto(user),
      tokens,
    };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    const payload = verifyRefreshToken(refreshToken, config.JWT_REFRESH_SECRET);

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
    });

    if (!user) {
      throw new UnauthorizedError('User account not found');
    }

    return this.generateTokens({
      userId: user.id,
      email: user.email,
    });
  }

  async getUserById(userId: string): Promise<UserDto> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return this.toUserDto(user);
  }

  private generateTokens(payload: { userId: string; email: string }): AuthTokens {
    const accessToken = signAccessToken(
      payload,
      config.JWT_ACCESS_SECRET,
      config.JWT_ACCESS_EXPIRES_IN
    );

    const refreshToken = signRefreshToken(
      payload,
      config.JWT_REFRESH_SECRET,
      config.JWT_REFRESH_EXPIRES_IN
    );

    return { accessToken, refreshToken };
  }

  private toUserDto(user: { id: string; email: string; createdAt: Date; updatedAt: Date }): UserDto {
    return {
      id: user.id,
      email: user.email,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}

export const authService = new AuthService();
