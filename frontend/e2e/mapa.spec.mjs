import { test, expect } from '@playwright/test';

const reportTitle = 'Cierre de la cuadra para verificar el desvío';
const credentials = {name:'Vecina del mapa',email:'mapa@example.test',password:'PruebaMapa123!'};
const origin = {lat:-12.0683,lng:-75.2103}, destination = {lat:-12.0717,lng:-75.2095};

test.beforeEach(async ({page})=>{
  // La prueba necesita el mapa y su capa de datos, no el servicio externo de teselas.
  await page.route('https://tile.openstreetmap.org/**', route=>route.abort());
});

async function demo(page) {
  await page.goto('/mapa');
  await page.getByRole('button',{name:/Probar Plaza Constitución/}).click();
  await expect(page.getByRole('button',{name:/Menos barreras registradas/})).toBeVisible();
  return page.getByRole('region',{name:'Pasos del recorrido'});
}

test('un reporte geolocalizado cambia la alternativa y las preferencias se conservan',async({page,browser,baseURL})=>{
  const registered=await page.request.post('/api/auth/register',{data:credentials});
  expect(registered.status()).toBe(201);
  const before=await page.request.post('/api/map/compare',{data:{origin,destination}});
  expect(before.ok()).toBeTruthy();
  const initial=(await before.json()).alternative.segments[0];

  const beforeSteps=await demo(page);
  await expect(page.getByRole('region',{name:'Mapa interactivo de Huancayo'})).toHaveClass(/leaflet-container/);
  await expect(beforeSteps.getByRole('button',{name:new RegExp(initial.name)})).toBeVisible();
  await beforeSteps.getByRole('button',{name:new RegExp(initial.name)}).click();
  await expect(page.getByRole('region',{name:'Detalle del tramo'}).getByText(/Pendiente/)).toBeVisible();
  await page.getByRole('button',{name:/Más corto en la red/}).click();
  await expect(beforeSteps.getByText('Paso central con escalones',{exact:true})).toBeVisible();

  await page.getByRole('button',{name:'Marcar barrera',exact:true}).click();
  await page.getByRole('region',{name:'Mapa interactivo de Huancayo'}).click({position:{x:120,y:100}});
  await expect(page.getByRole('button',{name:'Continuar reporte'})).toBeVisible();
  await page.getByRole('button',{name:'Continuar reporte'}).click();
  await expect(page.getByText(/Ubicación en el mapa:/)).toBeVisible();

  // Usa el punto medio del tramo concreto para que el caso sea reproducible con cualquier tamaño de ventana.
  const lat=(initial.a[0]+initial.b[0])/2, lng=(initial.a[1]+initial.b[1])/2;
  await page.goto('/comunidad?lat='+lat+'&lng='+lng);
  await page.getByLabel('Tipo de barrera').selectOption('blocked-ramp');
  await page.getByLabel('Título',{exact:true}).fill(reportTitle);
  await page.getByLabel('Descripción',{exact:true}).fill('Un objeto bloquea el paso en el punto indicado para esta prueba.');
  await page.getByRole('button',{name:'Enviar reporte'}).click();
  await expect(page.getByRole('heading',{name:reportTitle})).toBeVisible();

  const moderator=await browser.newPage({baseURL});
  try {
    const signed=await moderator.request.post('/api/auth/login',{data:{email:'administrador@example.test',password:'PruebaAdmin123!'}});
    expect(signed.ok()).toBeTruthy();
    await moderator.goto('/verificacion');
    await moderator.getByRole('button',{name:'Barreras para revisar'}).click();
    const item=moderator.getByRole('article').filter({hasText:reportTitle});
    await item.getByRole('button',{name:'Cerrar tramo'}).click();
    await expect(item.getByText('Tramo cerrado',{exact:true})).toBeVisible();
    const changed=await demo(page);
    await expect(changed.getByRole('button',{name:new RegExp(initial.name)})).toHaveCount(0);
    await expect(changed.getByRole('button').first()).toBeVisible();

    await item.getByRole('button',{name:'Marcar resuelto'}).click();
    await expect(item.getByText('Resuelto',{exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Actualizar mapa'}).click();
    await expect(changed.getByRole('button',{name:new RegExp(initial.name)})).toBeVisible();
  } finally {await moderator.close();}

  await page.goto('/preferencias');
  await page.getByLabel('Ancho mínimo (cm)').fill('100');
  await page.getByRole('button',{name:'Guardar preferencias'}).click();
  await expect(page.getByText('Preferencias guardadas.',{exact:true})).toBeVisible();
  await page.reload();
  await expect(page.getByLabel('Ancho mínimo (cm)')).toHaveValue('100');
  await page.goto('/recorridos');
  await expect(page.getByRole('heading',{name:'Del centro a Huamanmarca'})).toBeVisible();
  await expect(page.getByText('Demostración',{exact:true})).toBeVisible();
});

test('el mapa y la comparación caben en una pantalla móvil',async({page})=>{
  await page.setViewportSize({width:390,height:844});
  await demo(page);
  await expect(page.getByRole('heading',{name:'Planifica tu recorrido'})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
});
