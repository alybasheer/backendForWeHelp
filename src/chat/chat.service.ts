import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { MessageDocument } from './chat.schema';

@Injectable()
export class ChatService {
    constructor(
        @InjectModel('Message') private messageModel: Model<MessageDocument>,
    ) { }

    async saveMessage(senderId: string, receiverId: string, content: string) {
        const message = new this.messageModel({
            senderId: new Types.ObjectId(senderId),
            receiverId: new Types.ObjectId(receiverId),
            content,
            isRead: false,
            timestamp: new Date(),
        });
        return message.save();
    }

    async getConversation(userId: string, otherUserId: string, limit = 50) {
        // Convert string IDs to ObjectId for proper comparison
        const userObjectId = new Types.ObjectId(userId);
        const otherUserObjectId = new Types.ObjectId(otherUserId);

        return this.messageModel
            .find({
                $or: [
                    { senderId: userObjectId, receiverId: otherUserObjectId },
                    { senderId: otherUserObjectId, receiverId: userObjectId },
                ],
            })
            .sort({ createdAt: -1 })
            .limit(limit)
            .populate('senderId', 'username email')
            .populate('receiverId', 'username email')
            .exec();
    }

    async markMessagesAsRead(userId: string, senderId: string) {
        // Convert string IDs to ObjectId for proper comparison
        const userObjectId = new Types.ObjectId(userId);
        const senderObjectId = new Types.ObjectId(senderId);

        return this.messageModel.updateMany(
            { receiverId: userObjectId, senderId: senderObjectId, isRead: false },
            { isRead: true },
        );
    }

    async getUnreadCount(userId: string) {
        // Convert string ID to ObjectId for proper comparison
        const userObjectId = new Types.ObjectId(userId);

        return this.messageModel.countDocuments({
            receiverId: userObjectId,
            isRead: false,
        });
    }

    async getUserConversations(userId: string) {
        // Get unique conversations (last message from each user)
        const conversations = await this.messageModel.aggregate([
            {
                $match: {
                    $or: [{ senderId: new Types.ObjectId(userId) }, { receiverId: new Types.ObjectId(userId) }],
                },
            },
            {
                $addFields: {
                    otherUserId: {
                        $cond: [{ $eq: ['$senderId', new Types.ObjectId(userId)] }, '$receiverId', '$senderId'],
                    },
                },
            },
            {
                $sort: { createdAt: -1 },
            },
            {
                $group: {
                    _id: '$otherUserId',
                    lastMessage: { $first: '$$ROOT' },
                },
            },
            {
                $lookup: {
                    from: 'signups',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'user',
                },
            },
            {
                $unwind: '$user',
            },
            {
                $project: {
                    _id: 1,
                    user: {
                        _id: 1,
                        username: 1,
                        email: 1,
                    },
                    lastMessage: {
                        content: 1,
                        timestamp: 1,
                        isRead: 1,
                        senderId: 1,
                    },
                },
            },
            {
                $sort: { 'lastMessage.timestamp': -1 },
            },
        ]);

        return conversations;
    }

    async deleteMessage(messageId: string, userId: string) {
        // Find message and verify user is the sender (only sender can delete)
        const message = await this.messageModel.findById(messageId);

        if (!message) {
            return null;
        }

        // Verify the user is the sender
        if (message.senderId.toString() !== userId) {
            return null;
        }

        // Delete the message
        return this.messageModel.findByIdAndDelete(messageId);
    }

    async deleteConversation(userId: string, otherUserId: string) {
        // Delete all messages between two users
        const userObjectId = new Types.ObjectId(userId);
        const otherUserObjectId = new Types.ObjectId(otherUserId);

        return this.messageModel.deleteMany({
            $or: [
                { senderId: userObjectId, receiverId: otherUserObjectId },
                { senderId: otherUserObjectId, receiverId: userObjectId },
            ],
        });
    }
}
