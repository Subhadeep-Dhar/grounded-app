import { useState } from 'react';
import { View, TextInput, Button, Text } from 'react-native';
import { register } from '../../src/services/auth';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleRegister = async () => {
    try {
      await register(email, password);
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <View style={{ padding: 20 }}>
      <Text>Register</Text>

      <TextInput
        placeholder="Email"
        onChangeText={setEmail}
        style={{ borderWidth: 1, marginBottom: 10 }}
      />

      <TextInput
        placeholder="Password"
        secureTextEntry
        onChangeText={setPassword}
        style={{ borderWidth: 1, marginBottom: 10 }}
      />

      <Button title="Register" onPress={handleRegister} />
    </View>
  );
}