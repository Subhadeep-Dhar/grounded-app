import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { getFeed } from '../../src/services/feed';
import { Image } from 'react-native';

export default function Home() {
    const [feed, setFeed] = useState([]);

    useEffect(() => {
        getFeed().then(setFeed);
    }, []);

    return (
        <View>
            <Text>Feed</Text>

            {feed.map((item, i) => (
                <View key={i} style={{ marginBottom: 10 }}>
                    <Text>User: {item.userId}</Text>
                    <Text>Status: {item.status}</Text>
                    <Text>Score: {item.score}</Text>
                    {item.mediaUrl && (
                        <Image
                            source={{ uri: item.mediaUrl }}
                            style={{ width: 100, height: 100 }}
                        />
                    )}
                </View>
            ))}
        </View>
    );
}