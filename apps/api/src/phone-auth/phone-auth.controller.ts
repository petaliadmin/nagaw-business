import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import {
  phoneCredentialsSchema,
  phoneSignInSchema,
  type PhoneCredentialsInput,
  type PhoneSessionDto,
  type PhoneSignInInput,
} from '@nagaw/shared';
import { Public } from '../auth/public.decorator.js';
import type { AuthContext } from '../common/request-context.js';
import { ZodValidationPipe } from '../common/zod-validation.pipe.js';
import { CurrentUser } from '../tenancy/current.decorator.js';
import { PhoneAuthService } from './phone-auth.service.js';

/**
 * Phone number and secret code (ADR-058). Sign-in and sign-up are public:
 * they open the session; the web app keeps its tokens in its cookies.
 */
@Controller('auth/phone')
export class PhoneAuthController {
  constructor(private readonly phoneAuth: PhoneAuthService) {}

  @Public()
  @Post('sign-in')
  @HttpCode(HttpStatus.OK)
  signIn(
    @Body(new ZodValidationPipe(phoneSignInSchema)) body: PhoneSignInInput,
  ): Promise<PhoneSessionDto> {
    return this.phoneAuth.signIn(body.phone, body.pin);
  }

  @Public()
  @Post('sign-up')
  signUp(
    @Body(new ZodValidationPipe(phoneCredentialsSchema))
    body: PhoneCredentialsInput,
  ): Promise<PhoneSessionDto> {
    return this.phoneAuth.signUp(body.phone, body.pin);
  }

  /** The signed-in e-mail account moves to a number and a code. */
  @Post('link')
  @HttpCode(HttpStatus.OK)
  link(
    @CurrentUser() user: AuthContext,
    @Body(new ZodValidationPipe(phoneCredentialsSchema))
    body: PhoneCredentialsInput,
  ): Promise<PhoneSessionDto> {
    return this.phoneAuth.link(user, body.phone, body.pin);
  }
}
