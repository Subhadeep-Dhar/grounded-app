import { useEffect, useState } from 'react';
import { View, Text, Button, Image } from 'react-native';
import { db } from '../src/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

export default function Admin() {
    const [items, setItems] = useState([]);

    useEffect(() => {
        const fetch = async () => {
            const q = query(
                collection(db, 'submissions')
            );

            const snap = await getDocs(q);
            setItems(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        };

        fetch();
    }, []);

    return (
        <View>
            <Text>Flagged Submissions</Text>

            {items.map((item) => (
                <View key={item.id} style={{ marginBottom: 20 }}>
                    <Text>User: {item.userId}</Text>
                    <Text>Score: {item.score}</Text>

                    {item.mediaUrl && (
                        <Image
                            source={{ uri: item.mediaUrl }}
                            style={{ width: 120, height: 120 }}
                        />
                    )}
                </View>
            ))}
        </View>
    );
}