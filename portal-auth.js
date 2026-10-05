(function (global) {
  'use strict';

  const PROFILE_COLLECTION = 'portal_users';
  const ALIAS_DOMAIN = '@programacao-stc.firebaseapp.com';

  function normalizeLogin(value) {
    return String(value || '').trim().toLowerCase();
  }

  function authEmail(login) {
    const normalized = normalizeLogin(login);
    if (normalized.includes('@')) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
        throw new Error('Informe um e-mail válido.');
      }
      return normalized;
    }
    if (!/^[a-z0-9._-]+$/.test(normalized)) {
      throw new Error('Informe um usuário ou código de viatura válido.');
    }
    return normalized + ALIAS_DOMAIN;
  }

  function getProfile(user) {
    if (!user) return Promise.reject(new Error('Sessão encerrada.'));
    return firebase.firestore().collection(PROFILE_COLLECTION).doc(user.uid).get()
      .then(function (snapshot) {
        if (!snapshot.exists) {
          throw new Error('Acesso ainda não cadastrado. Procure o Backoffice.');
        }
        const profile = snapshot.data() || {};
        if (profile.ativo === false) {
          throw new Error('Acesso desativado. Procure o administrador.');
        }
        profile.login = profile.login || normalizeLogin(user.email.split('@')[0]);
        profile.perfil = String(profile.perfil || '').trim().toUpperCase();
        if (!['BACKOFFICE', 'ELETRICISTA'].includes(profile.perfil)) {
          throw new Error('Perfil de acesso inválido.');
        }
        if (!profile.utd) {
          throw new Error('Cadastro da UTD incompleto.');
        }
        if (profile.perfil === 'ELETRICISTA' && (!profile.base || !profile.viatura)) {
          throw new Error('Cadastro da viatura incompleto.');
        }
        return profile;
      });
  }

  function signIn(login, password, selectedProfile) {
    return Promise.resolve().then(function () {
      const email = authEmail(login);
      return firebase.auth().setPersistence(firebase.auth.Auth.Persistence.SESSION)
        .then(function () {
          return firebase.auth().signInWithEmailAndPassword(email, password);
        })
        .then(function (credential) {
          return getProfile(credential.user).then(function (profile) {
            if (profile.perfil !== selectedProfile) {
              return firebase.auth().signOut().then(function () {
                throw new Error('O perfil selecionado não corresponde a este acesso.');
              });
            }
            return profile;
          });
        });
    });
  }

  function requireProfile() {
    return new Promise(function (resolve, reject) {
      const unsubscribe = firebase.auth().onAuthStateChanged(function (user) {
        unsubscribe();
        if (!user) {
          global.location.replace('index.html');
          reject(new Error('Faça login para continuar.'));
          return;
        }
        getProfile(user).then(resolve).catch(function () {
          firebase.auth().signOut().finally(function () {
            global.location.replace('index.html');
          });
          reject(new Error('Não foi possível validar seu acesso.'));
        });
      }, reject);
    });
  }

  function signOut() {
    return firebase.auth().signOut().then(function () {
      global.location.replace('index.html');
    });
  }

  global.PortalAuth = {
    authEmail: authEmail,
    getProfile: getProfile,
    requireProfile: requireProfile,
    signIn: signIn,
    signOut: signOut
  };
})(window);
