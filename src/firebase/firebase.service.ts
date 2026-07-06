import { Injectable, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private firebaseApp: admin.app.App;

  onModuleInit() {
    if (admin.apps.length) {
      this.firebaseApp = admin.apps[0]!;
      return;
    }

    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (serviceAccountJson) {
      const credential = admin.credential.cert(JSON.parse(serviceAccountJson));
      this.firebaseApp = admin.initializeApp({ credential });
      return;
    }

    this.firebaseApp = admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  }

  async verifyGoogleToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
    try {
      const decoded = await this.firebaseApp.auth().verifyIdToken(idToken);
      return decoded;
    } catch (error) {
      throw new Error(`Invalid Google ID token: ${error.message}`);
    }
  }
}
