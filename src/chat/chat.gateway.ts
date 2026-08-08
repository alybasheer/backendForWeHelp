import { JwtService } from '@nestjs/jwt';
import { InjectModel } from '@nestjs/mongoose';
import {
    ConnectedSocket,
    MessageBody,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { Model } from 'mongoose';
import { Server, Socket } from 'socket.io';
import { HelpRequestDocument } from '../help-requests/help-request.schema';
import { ChatService } from './chat.service';

interface AuthSocket extends Socket {
    userId?: string;
}

@WebSocketGateway({
    cors: {
        origin: '*',
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true,
    },
})
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
    @WebSocketServer()
    server: Server;

    private connectedUsers = new Map<string, string>(); // Map of userId -> socketId

    constructor(
        private chatService: ChatService,
        private jwtService: JwtService,
        @InjectModel('HelpRequest') private helpRequestModel: Model<HelpRequestDocument>,
    ) { }

    afterInit(server: any) {
        console.log('✅ WebSocket Server Initialized');
    }

    async handleConnection(socket: AuthSocket) {
        try {
            // Extract token from handshake query or auth header
            const token = socket.handshake.auth?.token || socket.handshake.headers.authorization?.replace(/^Bearer\s+/i, '');

            if (!token) {
                socket.disconnect();
                console.log('❌ Connection rejected: No token provided');
                return;
            }

            // Verify token and get userId
            const payload: any = this.jwtService.verify(token, {
                secret: process.env.JWT_SECRET ?? 'dev_secret_key',
            });

            socket.userId = payload.sub;
            this.connectedUsers.set(payload.sub, socket.id);

            console.log(`✅ User ${payload.sub} (role=${payload.role}) connected with socket ${socket.id} [total connected: ${this.connectedUsers.size}]`);
            socket.emit('connection_success', { message: 'Connected to chat server', userId: payload.sub });
        } catch (error) {
            console.log('❌ Authentication failed:', error.message);
            socket.disconnect();
        }
    }

    handleDisconnect(socket: AuthSocket) {
        if (socket.userId) {
            this.connectedUsers.delete(socket.userId);
            console.log(`✅ User ${socket.userId} disconnected (socket ${socket.id}) [total connected: ${this.connectedUsers.size}]`);
        }
    }

    @SubscribeMessage('send_message')
    async handleSendMessage(
        @ConnectedSocket() socket: AuthSocket,
        @MessageBody() data: { receiverId: string; content: string },
    ) {
        try {
            const { receiverId, content } = data;
            const senderId = socket.userId;

            if (!content || !receiverId || !senderId) {
                socket.emit('error', { message: 'Content, receiverId, and senderId are required' });
                return;
            }

            // Save message to database
            const message = await this.chatService.saveMessage(senderId, receiverId, content);

            // Get receiver's socket ID
            const receiverSocketId = this.connectedUsers.get(receiverId);

            // Emit to receiver if online
            if (receiverSocketId) {
                socket.to(receiverSocketId).emit('receive_message', {
                    _id: message._id,
                    senderId: message.senderId,
                    receiverId: message.receiverId,
                    content: message.content,
                    timestamp: message.timestamp,
                    isRead: false,
                });
                console.log(`📨 Message sent from ${senderId} to ${receiverId} (online)`);
            } else {
                console.log(`📨 Message saved for offline user ${receiverId}`);
            }

            // Confirm delivery to sender
            socket.emit('message_sent', {
                _id: message._id,
                senderId: message.senderId,
                receiverId: message.receiverId,
                content: message.content,
                timestamp: message.timestamp,
                isRead: message.isRead,
                status: receiverSocketId ? 'delivered' : 'saved',
            });
        } catch (error) {
            socket.emit('error', { message: 'Failed to send message: ' + error.message });
        }
    }

    @SubscribeMessage('get_conversation')
    async handleGetConversation(
        @ConnectedSocket() socket: AuthSocket,
        @MessageBody() data: { otherUserId: string; limit?: number },
    ) {
        try {
            const { otherUserId, limit = 50 } = data;
            const userId = socket.userId;

            if (!userId) {
                socket.emit('error', { message: 'User not authenticated' });
                return;
            }

            const conversation = await this.chatService.getConversation(userId, otherUserId, limit);

            // Mark messages as read
            await this.chatService.markMessagesAsRead(userId, otherUserId);

            socket.emit('conversation_data', {
                otherUserId,
                messages: conversation.reverse(), // Return in chronological order
                totalMessages: conversation.length,
            });

            console.log(`📖 Conversation loaded: ${userId} ↔ ${otherUserId}`);
        } catch (error) {
            socket.emit('error', { message: 'Failed to load conversation: ' + error.message });
        }
    }

    @SubscribeMessage('typing')
    handleTyping(@ConnectedSocket() socket: AuthSocket, @MessageBody() data: { receiverId: string; isTyping: boolean }) {
        const receiverSocketId = this.connectedUsers.get(data.receiverId);
        if (receiverSocketId) {
            socket.to(receiverSocketId).emit('user_typing', {
                senderId: socket.userId,
                isTyping: data.isTyping,
            });
        }
    }

    @SubscribeMessage('update_location')
    async handleUpdateLocation(
        @ConnectedSocket() socket: AuthSocket,
        @MessageBody() data: { latitude: number; longitude: number; requestId: string },
    ) {
        const volunteerId = socket.userId;
        if (!volunteerId || typeof data.latitude !== 'number' || typeof data.longitude !== 'number' || !data.requestId) return;

        try {
            const request = await this.helpRequestModel.findById(data.requestId).exec();
            if (!request || !request.userId) return;

            const seekerId = request.userId.toString();
            const seekerSocketId = this.connectedUsers.get(seekerId);
            if (seekerSocketId) {
                this.server.to(seekerSocketId).emit('volunteer_location', {
                    volunteerId,
                    latitude: data.latitude,
                    longitude: data.longitude,
                    requestId: data.requestId,
                    timestamp: new Date().toISOString(),
                });
            }
        } catch { }
    }

    @SubscribeMessage('start_tracking')
    async handleStartTracking(
        @ConnectedSocket() socket: AuthSocket,
        @MessageBody() data: { requestId: string },
    ) {
        const volunteerId = socket.userId;
        if (!volunteerId || !data.requestId) return;
        try {
            const request = await this.helpRequestModel.findById(data.requestId).exec();
            if (!request || !request.userId) return;
            const seekerId = request.userId.toString();
            const seekerSocketId = this.connectedUsers.get(seekerId);
            if (seekerSocketId) {
                this.server.to(seekerSocketId).emit('tracking_status', {
                    volunteerId,
                    requestId: data.requestId,
                    status: 'en_route',
                    timestamp: new Date().toISOString(),
                });
            }
        } catch { }
    }

    @SubscribeMessage('stop_tracking')
    async handleStopTracking(
        @ConnectedSocket() socket: AuthSocket,
        @MessageBody() data: { requestId: string },
    ) {
        const volunteerId = socket.userId;
        if (!volunteerId || !data.requestId) return;
        try {
            const request = await this.helpRequestModel.findById(data.requestId).exec();
            if (!request || !request.userId) return;
            const seekerId = request.userId.toString();
            const seekerSocketId = this.connectedUsers.get(seekerId);
            if (seekerSocketId) {
                this.server.to(seekerSocketId).emit('tracking_status', {
                    volunteerId,
                    requestId: data.requestId,
                    status: 'arrived',
                    timestamp: new Date().toISOString(),
                });
            }
        } catch { }
    }

    // ──────────────────────────────────────────────
    // PUBLIC API — called by other modules
    // ──────────────────────────────────────────────

    /**
     * Send an event to a list of specific users (by their userId).
     * Only users who are currently connected via WebSocket will receive it.
     *
     * Used by HelpRequestsService to notify nearby volunteers of new requests.
     */
    notifyUsers(userIds: string[], event: string, data: any) {
        let notified = 0;
        for (const userId of userIds) {
            const socketId = this.connectedUsers.get(userId);
            if (socketId) {
                this.server.to(socketId).emit(event, data);
                notified++;
                console.log(`📢 [${event}] → user ${userId} socket ${socketId} EMITTED`);
            } else {
                console.log(`📢 [${event}] ✗ user ${userId} NOT CONNECTED (connectedUsers map miss)`);
            }
        }
        console.log(`📢 [${event}] Notified ${notified}/${userIds.length} users`);
        return notified;
    }

    /** Send an event to every currently connected socket. */
    broadcast(event: string, data: any) {
        this.server.emit(event, data);
        return this.connectedUsers.size;
    }

    /** Check if a specific user is currently connected. */
    isUserOnline(userId: string): boolean {
        return this.connectedUsers.has(userId);
    }

    /** Get the live socket id for a user, if connected. */
    getSocketIdForUser(userId: string): string | undefined {
        return this.connectedUsers.get(userId);
    }

    /** Get the list of all currently connected user IDs. */
    getConnectedUserIds(): string[] {
        return Array.from(this.connectedUsers.keys());
    }
}
