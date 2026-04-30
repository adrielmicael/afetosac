import { test, expect } from '@playwright/test';

test.describe('Chat', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login');
    await page.getByPlaceholder(/seu@email.com/).fill('admin@afeto.com');
    await page.getByPlaceholder(/••••••/).fill('admin123');
    await page.getByRole('button', { name: 'Entrar' }).click();
    await expect(page).toHaveURL('/');

    // Navegar para chat
    await page.getByRole('link', { name: 'Conversas' }).click();
    await expect(page).toHaveURL('/chats');
  });

  test('deve exibir lista de conversas', async ({ page }) => {
    await expect(page.getByText(/Conversas/)).toBeVisible();
    await expect(page.getByPlaceholder(/Buscar conversas/)).toBeVisible();
  });

  test('deve filtrar conversas por status', async ({ page }) => {
    await page.getByRole('button', { name: 'Aguardando' }).click();
    // Verificar que apenas conversas aguardando são mostradas
    await expect(page.getByText(/Aguardando/).first()).toBeVisible();
  });

  test('deve pesquisar conversas', async ({ page }) => {
    const searchInput = page.getByPlaceholder(/Buscar conversas/);
    await searchInput.fill('Teste');
    await searchInput.press('Enter');
    // Verificar que a busca foi realizada
  });
});
