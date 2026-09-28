import {
  doc,
  getDoc
} from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';

import { db } from '../config/firebase.js';

export class ContextError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'ContextError';
    this.code = code;
  }
}

export async function loadUserContext(firebaseUser) {
  const userRef = doc(db, 'users', firebaseUser.uid);
  const userSnapshot = await getDoc(userRef);

  if (!userSnapshot.exists()) {
    throw new ContextError(
      'user-profile-not-found',
      'Seu login existe no Firebase Authentication, mas o perfil do usuário ainda não foi provisionado no Firestore.'
    );
  }

  const userProfile = { id: userSnapshot.id, ...userSnapshot.data() };

  if (userProfile.status !== 'active') {
    throw new ContextError('user-inactive', 'Seu perfil está inativo no Sinal.');
  }

  if (!userProfile.defaultTenantId) {
    throw new ContextError('tenant-not-defined', 'Nenhuma organização padrão foi definida para este usuário.');
  }

  const tenantId = userProfile.defaultTenantId;
  const tenantRef = doc(db, 'tenants', tenantId);
  const memberRef = doc(db, 'tenants', tenantId, 'members', firebaseUser.uid);

  const [tenantSnapshot, memberSnapshot] = await Promise.all([
    getDoc(tenantRef),
    getDoc(memberRef)
  ]);

  if (!tenantSnapshot.exists()) {
    throw new ContextError('tenant-not-found', 'A organização vinculada ao usuário não foi encontrada.');
  }

  if (!memberSnapshot.exists()) {
    throw new ContextError('membership-not-found', 'O usuário não possui vínculo com a organização selecionada.');
  }

  const tenant = { id: tenantSnapshot.id, ...tenantSnapshot.data() };
  const membership = { id: memberSnapshot.id, ...memberSnapshot.data() };

  if (tenant.status !== 'active') {
    throw new ContextError('tenant-inactive', 'Esta organização está inativa.');
  }

  if (membership.status !== 'active') {
    throw new ContextError('membership-inactive', 'Seu vínculo com esta organização está inativo.');
  }

  return Object.freeze({
    firebaseUser,
    userProfile: Object.freeze(userProfile),
    tenant: Object.freeze(tenant),
    membership: Object.freeze(membership)
  });
}
