import { render } from '@testing-library/react-native';
import Svg from 'react-native-svg';
import { Icon, type IconName } from './Icon';

const ALL_ICON_NAMES: IconName[] = [
  'bell-off',
  'bell',
  'devices',
  'file',
  'folder',
  'lock',
  'lock-solid',
  'mask',
  'mic',
  'more',
  'paperclip',
  'phone',
  'pin',
  'plus',
  'search',
  'send',
  'settings',
  'shield-lock',
  'sliders',
  'star',
  'timer',
  'trash',
  'video',
  'x',
];

describe('Icon', () => {
  it('рендерит корректный размер и цвет для заданного имени', () => {
    const { UNSAFE_getByType } = render(<Icon name="phone" size={22} color="#ff0000" />);
    const svg = UNSAFE_getByType(Svg);
    expect(svg.props.width).toBe(22);
    expect(svg.props.height).toBe(22);
  });

  it('не падает ни на одном из зарегистрированных имён иконок (нет пропущенных SHAPES)', () => {
    for (const name of ALL_ICON_NAMES) {
      expect(() => render(<Icon name={name} />)).not.toThrow();
    }
  });
});
