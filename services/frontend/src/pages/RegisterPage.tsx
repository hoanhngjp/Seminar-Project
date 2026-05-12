import React from 'react';
import { RegisterForm } from '../features/auth/components/RegisterForm';

export default function RegisterPage() {
  return (
    <div className="bg-near-black min-h-screen flex items-center justify-center p-md font-body-regular text-text-base">
      <RegisterForm />
    </div>
  );
}
