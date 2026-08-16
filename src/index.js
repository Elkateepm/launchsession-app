import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';
import { registerServiceWorker } from './services/pushNotifications';

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// Register the push-notification service worker eagerly so it's ready by the
// time a user opts in from the branded prompt or Settings. This does NOT
// request notification permission or subscribe — that only happens after an
// explicit user action (see src/services/pushNotifications.js).
// The native splash is configured with launchAutoHide:false so it covers the
// gap while the JS bundle parses -- but nothing was dismissing it, so it stayed
// up for ever. Hidden once React has actually rendered.
if (typeof window !== 'undefined' && window.Capacitor?.isNativePlatform?.()) {
  import('@capacitor/splash-screen')
    .then(({ SplashScreen }) => SplashScreen.hide())
    .catch(() => { /* plugin absent in a web build; nothing to hide */ })
}

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { registerServiceWorker() });
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
