import { Injectable, OnModuleInit } from '@nestjs/common';
import * as admin from 'firebase-admin';
import * as path from 'path';

@Injectable()
export class FirebaseService implements OnModuleInit {
    private firebaseApp: admin.app.App;

    onModuleInit() {
        const serviceAccountPath = path.resolve(process.cwd(), 'serviceAccountKey.json');

        if (!this.firebaseApp) {
            try {
                const serviceAccount = require(serviceAccountPath);
                this.firebaseApp = admin.initializeApp({
                    credential: admin.credential.cert(serviceAccount),
                });
                console.log('Firebase Admin SDK initialized successfully');
            } catch (error) {
                console.warn(
                    'Firebase Admin SDK could not be initialized. ' +
                    'Place serviceAccountKey.json in project root. ' +
                    'Google login will not work until configured.',
                );
            }
        }
    }

    async verifyGoogleToken(idToken: string) {
        if (!this.firebaseApp) {
            throw new Error('Firebase is not configured. Add serviceAccountKey.json to project root.');
        }

        try {
            const decoded = await admin.auth().verifyIdToken(idToken);
            return {
                uid: decoded.uid,
                email: decoded.email || '',
                name: decoded.name || decoded.email?.split('@')[0] || '',
            };
        } catch (error) {
            throw new Error(`Invalid Firebase token: ${error.message}`);
        }
    }
}
