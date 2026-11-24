import { test, expect } from '@playwright/test';

function googleFixture() {
  const scene = window.mapTest = {lines:new Set(), dots:new Set(), fitted:[]};

  class Map {
    constructor(root) {
      this.root = root;
      root.dataset.testGoogleMap = '';
    }
    addListener(event, callback) {
      const click = () => callback({latLng:{toJSON:()=>({lat:-12.0698,lng:-75.2101})}});
      this.root.addEventListener(event,click);
      return {remove:()=>this.root.removeEventListener(event,click)};
    }
    setOptions() {}
    fitBounds(bounds) { scene.fitted = bounds.points; }
  }

  class LatLngBounds {
    points = [];
    extend(point) { this.points.push(point); }
  }

  class Polyline {
    constructor(options) { this.options = options; scene.lines.add(options); }
    addListener() { return {remove() {}}; }
    setMap(map) { if (!map) scene.lines.delete(this.options); }
  }

  class AdvancedMarkerElement {
    constructor(options) { this.options = options; scene.dots.add(options); }
    append() {}
    addEventListener() {}
    removeEventListener() {}
    set map(map) { if (!map) scene.dots.delete(this.options); }
  }

  const event = {
    addListenerOnce:()=>({remove() {}}),
    clearInstanceListeners() {},
  };
  window.google = {maps:{importLibrary:async()=>({Map,Polyline,LatLngBounds,AdvancedMarkerElement,event})}};
  window.raMapReady();
}

test('Google Maps dibuja la ruta registrada y la alternativa se conserva al fallar la clave',async({page})=>{
  await page.route('https://tile.openstreetmap.org/**', route=>route.abort());
  await page.route('https://maps.google.com/**', route=>route.abort());
  await page.route('**/api/config',async route=>{
    const response = await route.fetch();
    const config = await response.json();
    await route.fulfill({response,json:{...config,maps_key:'clave-de-prueba'}});
  });
  await page.route(url=>url.hostname==='maps.googleapis.com' && url.pathname==='/maps/api/js',route=>
    route.fulfill({contentType:'text/javascript',body:'('+googleFixture.toString()+')()'}));

  await page.goto('/mapa');
  const canvas=page.getByRole('region',{name:'Mapa interactivo de Huancayo'});
  await expect(canvas.locator('[data-test-google-map]')).toBeVisible();
  await page.getByRole('button',{name:/Probar Plaza Constitución/}).click();
  const steps=page.getByRole('region',{name:'Pasos del recorrido'});
  await expect(steps).toBeVisible();
  await expect.poll(()=>page.evaluate(()=>Array.from(window.mapTest.lines)
    .filter(line=>line.strokeWeight===6 && line.clickable && line.path.length===2).length)).toBeGreaterThan(0);
  expect(await page.evaluate(()=>window.mapTest.fitted.length)).toBeGreaterThan(1);
  expect(await page.evaluate(()=>Array.from(window.mapTest.dots,dot=>dot.title))).toEqual(
    expect.arrayContaining(['Origen','Destino']));

  await page.getByRole('button',{name:'Marcar barrera',exact:true}).click();
  await canvas.click({position:{x:120,y:100}});
  await expect(page.getByRole('button',{name:'Continuar reporte'})).toBeVisible();
  await page.evaluate(()=>window.gm_authFailure());
  await expect(canvas.locator('.leaflet-container')).toBeVisible();
  await expect(steps).toBeVisible();
  await expect(page.getByRole('button',{name:'Continuar reporte'})).toBeVisible();
});
