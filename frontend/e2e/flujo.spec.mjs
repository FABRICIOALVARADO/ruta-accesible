import { test, expect } from '@playwright/test';

test('un vecino guarda lugares y recorridos y un administrador atiende el reporte', async ({ page, browser, baseURL }) => {
  await page.goto('/');
  await expect(page.getByRole('heading',{name:/a tu ritmo/})).toBeVisible();
  await page.getByRole('navigation').getByRole('link',{name:'Explorar'}).click();
  await page.getByLabel('Buscar lugar').fill('constitucion');
  const results = page.locator('ra-place-card');
  await expect(results).toHaveCount(1);
  await results.getByRole('link',{name:/Ver ficha/}).click();
  await expect(page.getByRole('heading',{name:'Plaza Constitución',exact:true})).toBeVisible();
  await page.getByRole('button',{name:/Guardar favorito/}).click();
  await expect(page.getByRole('heading',{name:'Inicia sesión'})).toBeVisible();
  await page.getByRole('button',{name:'Crear una cuenta'}).click();
  await page.getByRole('button',{name:'Registrarme'}).click();
  await expect(page.getByText('Indica un correo válido.')).toBeVisible();
  await page.getByLabel('Nombre',{exact:true}).fill('Lucía Pérez');
  await page.getByLabel('Correo').fill('lucia@example.test');
  await page.getByLabel('Contraseña',{exact:true}).fill('PruebaVecino123!');
  await page.getByRole('button',{name:'Registrarme'}).click();
  await expect(page.getByRole('heading',{name:'Plaza Constitución',exact:true})).toBeVisible();
  await page.getByRole('button',{name:/Guardar favorito/}).click();
  await expect(page.getByRole('button',{name:/Guardado/})).toBeVisible();
  await page.getByLabel('Tu experiencia').fill('Encontré una entrada señalizada frente a la plaza.');
  await page.getByRole('button',{name:'Guardar reseña'}).click();
  await expect(page.getByText('Encontré una entrada señalizada frente a la plaza.')).toBeVisible();

  await page.getByRole('link',{name:'Planificar recorrido',exact:true}).click();
  await expect(page.getByLabel('Destino',{exact:true})).toHaveValue('Plaza Constitución');
  await page.getByLabel('Origen',{exact:true}).fill('Parque de la Identidad Wanka');
  await expect(page.locator('#destinations option')).not.toHaveCount(0);
  await page.getByRole('button',{name:'Calcular recorrido'}).click();
  await expect(page.getByText('Distancia estimada en línea recta.')).toBeVisible();
  await page.getByRole('button',{name:'Guardar recorrido'}).click();
  await page.getByLabel('Nombre del recorrido').fill('Visita al centro');
  await page.getByRole('button',{name:'Confirmar guardado'}).click();
  await expect(page.getByText('Visita al centro',{exact:true})).toBeVisible();

  await page.getByRole('navigation').getByRole('link',{name:'Comunidad'}).click();
  await page.getByLabel('Lugar del directorio').selectOption({label:'Plaza Constitución'});
  await page.getByLabel('Tipo de barrera').selectOption('blocked-ramp');
  await page.getByLabel('Título').fill('Rampa ocupada en la plaza');
  await page.getByLabel('Descripción').fill('Un obstáculo impide usar la rampa al lado de la entrada principal.');
  await page.getByRole('button',{name:'Enviar reporte'}).click();
  await expect(page.getByRole('heading',{name:'Rampa ocupada en la plaza'})).toBeVisible();

  const admin = await browser.newPage({baseURL});
  try {
    await admin.goto('/cuenta');
    await admin.getByLabel('Correo').fill('administrador@example.test');
    await admin.getByLabel('Contraseña',{exact:true}).fill('PruebaAdmin123!');
    await admin.locator('form').getByRole('button',{name:'Entrar',exact:true}).click();
    await admin.getByRole('navigation').getByRole('link',{name:'Administrar'}).click();
    await expect(admin.getByRole('heading',{name:'Panel de gestión'})).toBeVisible();
    await admin.getByRole('button',{name:'Nuevo lugar',exact:true}).click();
    await admin.getByLabel('Nombre',{exact:true}).fill('Biblioteca del barrio');
    await admin.getByLabel('Dirección',{exact:true}).fill('Jr. Los Andes 815');
    await admin.getByLabel('Descripción',{exact:true}).fill('Lugar de prueba para el directorio de la ciudad.');
    await admin.getByRole('button',{name:'Rampa',exact:true}).click();
    await admin.getByRole('button',{name:'Guardar ficha'}).click();
    const row = admin.getByRole('article').filter({hasText:'Biblioteca del barrio'});
    await expect(row).toBeVisible();
    await row.getByRole('button',{name:'Archivar',exact:true}).click();
    await row.getByRole('button',{name:'Confirmar archivo',exact:true}).click();
    await expect(row.getByText('Archivado',{exact:true})).toBeVisible();
    await row.getByRole('button',{name:'Restaurar',exact:true}).click();
    await expect(row.getByRole('button',{name:'Archivar',exact:true})).toBeVisible();
    await admin.getByRole('button',{name:'Reportes',exact:true}).click();
    await admin.getByRole('button',{name:'Pasar a revisión'}).click();
    await admin.getByRole('button',{name:'Marcar resuelto'}).click();
    await expect(admin.getByText('Resuelto',{exact:true})).toBeVisible();
  } finally { await admin.close(); }

  await page.reload();
  await page.getByRole('button',{name:'Historial'}).click();
  const history = page.getByRole('article').filter({hasText:'Rampa ocupada en la plaza'});
  await expect(history.getByRole('listitem')).toHaveCount(3);
  await expect(history.getByRole('listitem').last()).toContainText('Resuelto');
  await page.locator('header').getByRole('link',{name:'Mi cuenta',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Plaza Constitución',exact:true})).toBeVisible();
});

test('el menú móvil permite abrir y filtrar el directorio', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/');
  await page.getByRole('button',{name:'Menú'}).click();
  await page.getByRole('navigation').getByRole('link',{name:'Explorar'}).click();
  await expect(page.getByRole('heading',{name:'Explorar Huancayo'})).toBeVisible();
  await page.getByLabel('Distrito').selectOption('tambo');
  await expect(page.locator('ra-place-card')).toHaveCount(1);
  await expect(page.getByRole('heading',{name:'Parque de los Sombreros'})).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});

test('la portada conserva el contenido con movimiento reducido y con texto ampliado', async ({ page }) => {
  await page.setViewportSize({width:390,height:844});
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.goto('/');
  const title = page.getByRole('heading',{name:/a tu ritmo/});
  const line = title.locator('.title-line > span').first();
  await expect(line).toHaveCSS('animation-name','headline-in');
  await page.emulateMedia({reducedMotion:'reduce'});
  await expect(line).toHaveCSS('animation-name','none');
  await expect(title).toBeVisible();
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.getByRole('button',{name:'Texto ampliado y contraste alto'}).click();
  await expect(line).toHaveCSS('animation-name','none');
  await expect(page.getByRole('link',{name:/Abrir mapa y rutas/})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
