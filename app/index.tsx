import { Redirect } from 'expo-router';

/** Local-first entry — skip auth, land on Daily Command. */
export default function Index() {
  return <Redirect href="/(tabs)/home" />;
}
