import { Injectable, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

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
      console.log('Firebase Admin SDK initialized from FIREBASE_SERVICE_ACCOUNT_JSON');
      return;
    }

    const serviceAccountPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
    if (fs.existsSync(serviceAccountPath)) {
      const serviceAccount = require(serviceAccountPath);
      this.firebaseApp = admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      console.log('Firebase Admin SDK initialized from serviceAccountKey.json');
      return;
    }

    this.firebaseApp = admin.initializeApp({
      credential: admin.credential.applicationDefault(),
    });
  }

  async verifyGoogleToken(idToken: string): Promise<admin.auth.DecodedIdToken> {
    if (!this.firebaseApp) {
      throw new Error(
        'Firebase is not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON or add serviceAccountKey.json to project root.',
      );
    }
    try {
      const decoded = await this.firebaseApp.auth().verifyIdToken(idToken);
      return decoded;
    } catch (error) {
      throw new Error(`Invalid Google ID token: ${error.message}`);
    }
  }
}
