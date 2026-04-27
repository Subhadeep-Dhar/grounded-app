import { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
import { getTodayChallenge } from '../../src/services/challenge';
import { useAuthStore } from '../../src/store/authStore';
import { Button } from 'react-native';
import { submitChallenge } from '../../src/services/submission';
import { getCurrentLocation } from '../../src/services/gps';
import { getDistance } from '../../src/utils/location';
import { captureImage } from '../../src/services/camera';

export default function Challenge() {
  const { user } = useAuthStore();
  const [challenge, setChallenge] = useState(null);

  useEffect(() => {
    if (user) {
      getTodayChallenge(user.uid).then((data) => {
        console.log("Fetched challenge:", data);
        setChallenge(data);
      });
    }
  }, [user]);

  const handleSubmit = async () => {
    try {
      const loc = await getCurrentLocation();

      console.log("User loc:", loc);
      console.log("Challenge:", challenge);

      const lat1 = parseFloat(loc.coords?.latitude || loc.latitude);
      const lon1 = parseFloat(loc.coords?.longitude || loc.longitude);

      const lat2 = parseFloat(challenge?.latitude);
      const lon2 = parseFloat(challenge?.longitude);

      console.log("lat1:", lat1, "lon1:", lon1);
      console.log("lat2:", lat2, "lon2:", lon2);

      if (isNaN(lat2) || isNaN(lon2)) {
        alert("Challenge location missing ❌");
        return;
      }

      const dist = getDistance(lat1, lon1, lat2, lon2);
      console.log("dist:", dist);

      const locationOk = dist <= challenge.radius;

      if (!locationOk) {
        alert("Not at location ❌");
        return;
      }

      const image = await captureImage();
      if (!image) return;

      await submitChallenge(user.uid, challenge, image, locationOk);

      alert("Submitted ✅");

    } catch (e) {
      alert(e.message);
    }
  };

  if (!challenge) return <Text>Loading...</Text>;

  return (
    <View>
      <Text>Today's Challenge</Text>
      <Text>{challenge.task}</Text>
      <Text>{challenge.location}</Text>

      <Button title="Submit" onPress={handleSubmit} />
    </View>
  );
}