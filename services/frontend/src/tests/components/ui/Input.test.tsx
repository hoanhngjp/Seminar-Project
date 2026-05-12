import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Input from '../../../components/ui/Input';

describe('Input', () => {
  it('renders with placeholder', () => {
    render(<Input placeholder="Email của bạn" />);
    expect(screen.getByPlaceholderText('Email của bạn')).toBeInTheDocument();
  });

  it('renders label and associates it with input', () => {
    render(<Input label="Email" />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('shows error message when error prop is set', () => {
    render(<Input label="Email" error="Email không hợp lệ" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Email không hợp lệ');
  });

  it('marks input as invalid when error is set', () => {
    render(<Input label="Email" error="Lỗi" />);
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-invalid', 'true');
  });

  it('does not show error message when no error', () => {
    render(<Input label="Email" />);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('toggles password visibility when passwordToggle is set', () => {
    render(<Input label="Mật khẩu" type="password" passwordToggle />);
    const input = screen.getByLabelText('Mật khẩu');
    expect(input).toHaveAttribute('type', 'password');

    fireEvent.click(screen.getByLabelText('Hiện mật khẩu'));
    expect(input).toHaveAttribute('type', 'text');

    fireEvent.click(screen.getByLabelText('Ẩn mật khẩu'));
    expect(input).toHaveAttribute('type', 'password');
  });

  it('does not render toggle button when passwordToggle is false', () => {
    render(<Input label="Email" />);
    expect(screen.queryByLabelText('Hiện mật khẩu')).not.toBeInTheDocument();
  });

  it('accepts value and onChange', () => {
    render(<Input label="Email" defaultValue="test@example.com" />);
    expect(screen.getByLabelText('Email')).toHaveValue('test@example.com');
  });
});
