import { LoginForm } from '../features/auth/components/LoginForm';

export default function LoginPage() {
  return (
    <div className="bg-near-black min-h-screen flex items-center justify-center p-md font-body-regular text-text-base">
      <LoginForm />
    </div>
  );
}
