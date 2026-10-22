import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { THEME_STORAGE_KEY, ThemeProvider } from './theme-provider';
import { ThemeToggle } from './theme-toggle';

function renderToggle() {
  render(
    <ThemeProvider>
      <ThemeToggle />
    </ThemeProvider>,
  );
  return userEvent.setup();
}

async function choose(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.click(screen.getByRole('button', { name: 'Theme' }));
  await user.click(await screen.findByRole('menuitemradio', { name }));
}

describe('ThemeToggle', () => {
  afterEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    document.documentElement.removeAttribute('style');
  });

  it('adds the dark class for Dark, removes it for Light and stores each choice', async () => {
    const user = renderToggle();

    await choose(user, 'Dark');
    await waitFor(() => expect(document.documentElement).toHaveClass('dark'));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    await choose(user, 'Light');
    await waitFor(() => expect(document.documentElement).not.toHaveClass('dark'));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('defaults to System and marks the current choice', async () => {
    const user = renderToggle();

    await user.click(screen.getByRole('button', { name: 'Theme' }));
    expect(await screen.findByRole('menuitemradio', { name: 'System' })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('menuitemradio', { name: 'Dark' })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('applies a theme stored earlier', async () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    renderToggle();
    await waitFor(() => expect(document.documentElement).toHaveClass('dark'));
  });
});
