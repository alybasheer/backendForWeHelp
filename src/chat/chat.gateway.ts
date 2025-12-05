import { JwtService } from '@nestjs/jwt';
import {
    ConnectedSocket,
    MessageBody,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    SubscribeMessage,
    WebSocketGateway,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
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
    private connectedUsers = new Map<string, string>(); // Map of userId -> socketId

    constructor(
        private chatService: ChatService,
        private jwtService: JwtService,
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

            console.log(`✅ User ${payload.sub} connected with socket ${socket.id}`);
            socket.emit('connection_success', { message: 'Connected to chat server', userId: payload.sub });
        } catch (error) {
            console.log('❌ Authentication failed:', error.message);
            socket.disconnect();
        }
    }

    handleDisconnect(socket: AuthSocket) {
        if (socket.userId) {
            this.connectedUsers.delete(socket.userId);
            console.log(`✅ User ${socket.userId} disconnected`);
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
                receiverId,
                content,
                timestamp: message.timestamp,
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
}
