import { AVATAR_PHOTO_MAX_CHARS, AVATAR_PHOTO_SIZE, type Avatar } from '@couchwave/shared';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

export type PhotoResult =
  { status: 'ok'; avatar: Avatar } | { status: 'cancelled' } | { status: 'error'; message: string };

/**
 * Takes a selfie (or picks a photo), crops it to a centred square and shrinks it to a
 * small JPEG, so it can travel over the socket and be shown on every screen.
 */
export async function pickAvatarPhoto(source: 'camera' | 'library'): Promise<PhotoResult> {
  if (source === 'camera' && Platform.OS !== 'web') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      return { status: 'error', message: 'Allow camera access to take a selfie.' };
    }
  }

  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: 'images',
    allowsEditing: true,
    aspect: [1, 1],
    quality: 0.8,
    cameraType: ImagePicker.CameraType.front,
  };
  const result =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

  const asset = result.assets?.[0];
  if (result.canceled || !asset) return { status: 'cancelled' };

  try {
    return { status: 'ok', avatar: await toAvatarPhoto(asset) };
  } catch {
    return { status: 'error', message: "Couldn't use that photo. Try another one." };
  }
}

async function toAvatarPhoto(asset: ImagePicker.ImagePickerAsset): Promise<Avatar> {
  let context = ImageManipulator.manipulate(asset.uri);

  // The picker's square crop isn't available everywhere (e.g. web), so crop here too
  const side = Math.min(asset.width, asset.height);
  if (side > 0 && asset.width !== asset.height) {
    context = context.crop({
      originX: Math.floor((asset.width - side) / 2),
      originY: Math.floor((asset.height - side) / 2),
      width: side,
      height: side,
    });
  }

  const image = await context
    .resize({ width: AVATAR_PHOTO_SIZE, height: AVATAR_PHOTO_SIZE })
    .renderAsync();
  const { base64 } = await image.saveAsync({
    base64: true,
    compress: 0.7,
    format: SaveFormat.JPEG,
  });
  if (!base64) throw new Error('No image data');

  const dataUrl = `data:image/jpeg;base64,${base64}`;
  if (dataUrl.length > AVATAR_PHOTO_MAX_CHARS) throw new Error('Photo too large');
  return { kind: 'photo', dataUrl };
}
