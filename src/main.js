// Ponto de entrada do navegador.
import { App } from './ui/app.js';
import { createStorage } from './progression/storage.js';
import { validateCards } from './data/cards.js';
import { toast } from './ui/dom.js';

const errors = validateCards();
if (errors.length) console.error('Dados de cartas inválidos:', errors);

window.addEventListener('error', (e) => {
  console.error(e.error || e.message);
  toast('Ocorreu um erro inesperado. O progresso foi preservado.', 'bad');
});
window.addEventListener('unhandledrejection', (e) => console.error(e.reason));

const app = new App(document.getElementById('app'), createStorage());
app.start();
// Exposto apenas para depuração e testes automatizados de navegador.
window.__bastioes = app;
