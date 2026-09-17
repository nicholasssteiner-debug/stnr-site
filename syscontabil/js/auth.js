// Autenticação (e-mail/senha) e a tela de acesso.
import { auth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from './firebase.js';
import { session } from './state.js';
import { refreshIcons } from './ui.js';

let isLoginMode = true;

const AUTH_MESSAGES = {
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/user-not-found': 'E-mail ou senha incorretos.',
    'auth/wrong-password': 'E-mail ou senha incorretos.',
    'auth/invalid-email': 'E-mail inválido.',
    'auth/email-already-in-use': 'Este e-mail já está em uso.',
    'auth/weak-password': 'A senha deve ter pelo menos 6 caracteres.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
    'auth/network-request-failed': 'Sem conexão. Verifique a internet e tente novamente.',
    'auth/operation-not-allowed': 'Método de acesso indisponível. Contate o administrador.',
};

export const toggleAuthMode = () => {
    isLoginMode = !isLoginMode;
    document.getElementById('auth-title').innerText = isLoginMode ? 'Acesse sua conta' : 'Crie uma nova conta';
    document.getElementById('auth-btn-text').innerText = isLoginMode ? 'Entrar' : 'Cadastrar';
    document.getElementById('auth-btn-icon').setAttribute('data-lucide', isLoginMode ? 'log-in' : 'user-plus');
    document.getElementById('auth-switch-text').innerText = isLoginMode ? 'Não tem uma conta?' : 'Já tem uma conta?';
    document.getElementById('auth-switch-btn').innerText = isLoginMode ? 'Criar agora' : 'Fazer login';
    document.getElementById('auth-error').classList.add('hidden');
    refreshIcons();
};

export const handleAuthSubmit = async (e) => {
    e.preventDefault();
    const email = document.getElementById('auth-email').value.trim();
    const pass = document.getElementById('auth-pass').value;
    const errEl = document.getElementById('auth-error');
    const btn = document.getElementById('auth-submit-btn');

    errEl.classList.add('hidden');
    btn.disabled = true;
    try {
        if (isLoginMode) await signInWithEmailAndPassword(auth, email, pass);
        else await createUserWithEmailAndPassword(auth, email, pass);
    } catch (error) {
        console.error(error);
        errEl.innerText = AUTH_MESSAGES[error.code] || 'Não foi possível acessar. Tente novamente.';
        errEl.classList.remove('hidden');
    } finally {
        btn.disabled = false;
    }
};

export const doLogout = () => signOut(auth);

// Chama `onLogin(user)` / `onLogout()` conforme o estado da sessão.
export const watchAuth = ({ onLogin, onLogout }) => {
    onAuthStateChanged(auth, (user) => {
        const overlay = document.getElementById('auth-overlay');
        if (user) {
            session.user = user;
            overlay.classList.add('opacity-0', 'pointer-events-none');
            document.getElementById('user-email-display').innerText = user.email;
            onLogin(user);
        } else {
            overlay.classList.remove('opacity-0', 'pointer-events-none');
            document.getElementById('user-email-display').innerText = '';
            onLogout();
        }
    });
};
