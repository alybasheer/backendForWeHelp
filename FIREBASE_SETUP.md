FIREBASE SETUP GUIDE
====================

## STEP 1: Create Firebase Project

1. Go to https://console.firebase.google.com/
2. Click "Create Project" or select existing project
3. Enable Google Sign-In:
   - Go to Authentication > Sign-in method
   - Enable "Google"
   - Click Save

## STEP 2: Get Service Account Key

1. Go to Project Settings > Service Accounts tab
2. Click "Generate New Private Key"
3. A JSON file will download (serviceAccountKey.json)
4. **Place this file in your project root directory:**
   ```
   c:\backend\nest_concepts\serviceAccountKey.json
   ```

⚠️ **IMPORTANT:** Never commit this file to git! Add to .gitignore:
   ```
   serviceAccountKey.json
   node_modules/
   dist/
   ```

## STEP 3: Environment Variables (Optional but Recommended)

Create `.env` file in project root:
```
MONGODB_URL=mongodb://localhost:27017/nest_concepts
JWT_SECRET=your-secret-key
FIREBASE_DATABASE_URL=https://your-project.firebaseio.com
```

## STEP 4: Update Your Backend Code

✅ Already done! I've updated:
- Created `/src/firebase/firebase.service.ts` - Verifies Google tokens
- Created `/src/firebase/firebase.module.ts` - Firebase module
- Updated `/src/authentication/authentication.service.ts` - Uses Firebase verification
- Updated `/src/authentication/authentication.controller.ts` - New endpoint
- Updated `/src/app.module.ts` - Registered Firebase module

## STEP 5: Frontend Implementation (Flutter)

### Install FlutterFire:
```bash
flutter pub add google_sign_in
flutter pub add firebase_core
flutter pub add firebase_auth
```

### Flutter Code:
```dart
import 'package:google_sign_in/google_sign_in.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';

// Initialize Firebase
await Firebase.initializeApp();

final googleSignIn = GoogleSignIn();
final googleUser = await googleSignIn.signIn();

if (googleUser != null) {
  final googleAuth = await googleUser.authentication;
  final idToken = googleAuth.idToken;
  
  // Send to backend
  final response = await http.post(
    Uri.parse('http://<backend-ip>:3000/authentication/google-login'),
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode({
      'idToken': idToken,
      'username': googleUser.displayName,
    }),
  );
  
  final data = jsonDecode(response.body);
  final accessToken = data['access_token'];
  
  // Save token securely
  await secureStorage.write(key: 'auth_token', value: accessToken);
}
```

## STEP 6: Test in Postman

After placing serviceAccountKey.json and starting the app:

```
POST http://localhost:3000/authentication/google-login

Body (JSON):
{
  "idToken": "<actual-firebase-id-token>",
  "username": "testuser"
}
```

To get a real idToken for testing:
1. Use Firebase emulator, OR
2. Create a test user in Flutter app, OR
3. Use Google's OAuth playground: https://developers.google.com/oauthplayground/

## STEP 7: How It Works

```
User (Flutter App)
  ↓
Clicks "Login with Google"
  ↓
Google Sign-In SDK handles authentication
  ↓
Returns idToken (JWT from Google)
  ↓
Send idToken to Backend: POST /authentication/google-login
  ↓
Backend verifies idToken with Firebase Admin SDK
  ↓
If valid:
  → Check if user exists in MongoDB
  → If not, create new user
  → Generate app JWT token
  → Return access_token
  ↓
Frontend stores access_token
  ↓
Use for authenticated requests

```

## API Endpoint

**URL:** `POST http://localhost:3000/authentication/google-login`

**Body:**
```json
{
  "idToken": "eyJhbGciOiJSUzI1NiIsImtpZCI6IjE2MjM0NTY3ODkifQ...",
  "username": "john_doe"
}
```

**Response:**
```json
{
  "success": true,
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "_id": "user_123",
    "username": "john_doe",
    "email": "john@gmail.com",
    "role": "user",
    "googleId": "firebase-uid-123"
  }
}
```

## TROUBLESHOOTING

❌ Error: "serviceAccountKey.json not found"
→ Make sure file is in project root (c:\backend\nest_concepts\)

❌ Error: "Invalid idToken"
→ Make sure you're sending actual Firebase ID token, not custom token

❌ Error: "Firebase initialization error"
→ Check credentials in serviceAccountKey.json are valid

✅ Success: idToken verified, user created/logged in

## SECURITY NOTES

✅ Token verification happens on backend (not frontend)
✅ serviceAccountKey.json is never exposed to frontend
✅ Only idToken travels over network (verified server-side)
✅ App JWT token is short-lived (expires in 1 hour by default)
✅ Much more secure than trusting frontend claims

## NEXT STEPS

1. Download serviceAccountKey.json from Firebase Console
2. Place in project root
3. Run `npm run build` to verify
4. Run `npm run start:dev` to start backend
5. Test with actual Flutter app using Google Sign-In
