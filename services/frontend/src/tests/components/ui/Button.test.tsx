import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Button from '../../../components/ui/Button';

describe('Button', () => {
  it('renders children', () => {
    render(<Button>Đăng nhập</Button>);
    expect(screen.getByRole('button', { name: 'Đăng nhập' })).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Click me</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled when disabled prop is set', () => {
    render(<Button disabled>Bị khoá</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('does not call onClick when disabled', () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Bị khoá</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('renders primary variant with spotify-green classes', () => {
    render(<Button variant="primary">Primary</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('bg-spotify-green');
    expect(btn.className).toContain('text-near-black');
  });

  it('renders pill-dark variant', () => {
    render(<Button variant="pill-dark">Pill Dark</Button>);
    expect(screen.getByRole('button').className).toContain('bg-mid-dark');
  });

  it('renders outlined variant', () => {
    render(<Button variant="outlined">Outlined</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toContain('border');
    expect(btn.className).toContain('bg-transparent');
  });

  it('renders circular variant', () => {
    render(<Button variant="circular" aria-label="Play">▶</Button>);
    const btn = screen.getByRole('button', { name: 'Play' });
    expect(btn.className).toContain('rounded-full');
    expect(btn.className).toContain('bg-spotify-green');
  });

  it('accepts additional className', () => {
    render(<Button className="extra-class">Custom</Button>);
    expect(screen.getByRole('button').className).toContain('extra-class');
  });

  it('forwards type attribute', () => {
    render(<Button type="submit">Submit</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
  });
});
