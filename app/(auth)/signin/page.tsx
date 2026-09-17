import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui';
import { MobileOtpSignIn } from '@/components/auth/MobileOtpSignIn';

export default function SignInPage() {
  return (
    <Card variant="elevated">
      <CardHeader>
        <CardTitle className="font-basier text-2xl">
          Sign{' '}
          <span className="italic bg-gradient-rainbow bg-clip-text text-transparent">
            in
          </span>
        </CardTitle>
        <CardDescription>
          Enter your Indian mobile number to receive an OTP
        </CardDescription>
      </CardHeader>
      <CardContent>
        <MobileOtpSignIn />
      </CardContent>
    </Card>
  );
}
