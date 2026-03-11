// Temporary reusable helpers for voice/image upload flows.

export async function stopRecordingAndUpload({
  recording,
  setIsRecording,
  setRecording,
  uploadFileToServer,
}) {
  if (!recording) {
    return;
  }

  setIsRecording(false);
  await recording.stopAndUnloadAsync();
  const uri = recording.getURI();
  setRecording(undefined);
  await uploadFileToServer(uri, 'voice');
}

export function handleImagePicked({ result, setImageUri, uploadFileToServer }) {
  if (!result?.canceled && result?.assets?.[0]?.uri) {
    const uri = result.assets[0].uri;
    setImageUri(uri);
    uploadFileToServer(uri, 'image');
  }
}

export async function pickImageFromGallery({
  ImagePicker,
  Alert,
  handlePicked,
}) {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== 'granted') {
    Alert.alert('Cần quyền', 'Cần quyền truy cập ảnh.');
    return;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsEditing: true,
    aspect: [4, 3],
    quality: 0.7,
  });

  handlePicked(result);
}