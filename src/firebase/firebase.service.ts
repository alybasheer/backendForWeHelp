import { Injectable, OnModuleInit, UnauthorizedException } from '@nestjs/common';
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
      try {
        const credential = admin.credential.cert(JSON.parse(serviceAccountJson));
        this.firebaseApp = admin.initializeApp({ credential });
        console.log('Firebase Admin SDK initialized from FIREBASE_SERVICE_ACCOUNT_JSON');
        return;
      } catch (error) {
        console.error(
          'Firebase: FIREBASE_SERVICE_ACCOUNT_JSON is malformed, falling back to serviceAccountKey.json/applicationDefault:',
          (error as Error).message,
        );
      }
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
      throw new UnauthorizedException(
        'Google sign-in is temporarily unavailable',
      );
    }
    try {
      const decoded = await this.firebaseApp.auth().verifyIdToken(idToken);
      return decoded;
    } catch {
      throw new UnauthorizedException('Invalid Google sign-in token');
    }
  }
}
