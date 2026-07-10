export interface UserProfile {
    id: number;
    username: string;
    role: 'CITIZEN' | 'ENFORCER' | 'INSPECTOR' | 'ADMIN';
    avatar?: string | null;
    citizen_id?: string;
    privacy?: string;
    discord_username?: string | null;
    discord_id?: string | null;
    bio?: string | null;
    credits?: number;
    interface_theme?: string | null;
    pointer_skin?: string | null;
}

export interface ChatMessage {
    id: number;
    senderId: number;
    receiverId?: number | null;
    groupId?: number | null;
    text: string;
    isReadOnce: boolean | number;
    replyToId?: number | null;
    attachment?: string | null;
    created_at: string;
    
    senderName?: string;
    senderAvatar?: string | null;
    senderRole?: string;
    senderCC?: number;
    senderGroupName?: string | null;
    senderGroupId?: number | null;
    senderAvatarBorder?: string | null;
    senderNameEffect?: string | null;

    groupName?: string | null;
    
    parentText?: string | null;
    parentSenderName?: string | null;
    parentAvgCC?: number | null;

    targetType?: 'PUBLIC' | 'GROUP' | 'PRIVATE';
    reactions?: Record<string, string[]>;
}

export interface ChatGroup {
    id: number;
    name: string;
    inspectorId: number;
    maxCC: number;
    created_at: string;
    bio?: string | null;
    avatar?: string | null;
}

export interface ChatGroupMember {
    groupId: number;
    userId: number;
    role: string;
    joined_at: string;
}

export interface FriendRequest {
    id: number;
    senderId: number;
    receiverId: number;
    status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
    created_at: string;
}

export interface Cosmetic {
    id: number;
    name: string;
    type: string;
    price: number;
    description: string;
    value: string;
}

export interface AuthSession {
    token: string;
    userId: number;
    createdAt: number;
    expiresAt: number;
}
