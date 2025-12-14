// CORE
import { ElementMapper } from "../lib/element-mapper.js";
import { Animator } from "../layout/animator.js";
import { Base } from "../layout/base.js";
import { Text } from "../layout/text.js";
import { Image } from "../layout/image.js";
import { Link } from "../layout/link.js";
import { FlexRow } from "../layout/flex-row.js";
import { CustomDivRenderer } from "../layout/nav-factor/custom-div.js";
import { UINavBar } from "../layout/new-nav-bar.js";
import { SideBar } from "../layout/side-bar.js";
import { SideNav } from "../layout/side-nav-bar.js";
import { Free } from "../layout/free.js";
import { Audio } from "../layout/audio.js";
import { Audionew } from "../layout/audionew.js";
import { Progress } from "../layout/progress.js";
import { Center } from "../layout/center.js";
import { Code } from "../layout/code.js";
import { Stack } from "../layout/stack.js";
import { Wrapper } from "../layout/container.js";
import { MetaAdder } from "../layout/meta-adder.js";
import { Table } from "../layout/table.js";
import { Dropdown } from "../layout/dropdown-2025.js";
import { Modal } from "../layout/modal-2025.js";
import { TextField } from "../layout/text-field.js";
import { Card } from "../layout/flex-card.js";
import { Wrap } from "../layout/wrap.js";
import { FlexGrid } from "../layout/flex-grid.js";
import { ZoomCard } from "../layout/zoom-card.js";
import { SimpleBar } from "../layout/simple-bar.js";
import { DesktopBar } from "../layout/beta-desktop-bar.js";
import { MobileBar } from "../layout/beta-mobile-bar.js";
import { Switcher } from "../layout/multiswitcher.js";
import { Spacer } from "../layout/spacer.js";
import { HScroller } from "../layout/horizontal-scroller.js";
import { Checkbox } from "../layout/checkbox.js";
import { Video } from "../layout/video.js";
import { UList } from "../layout/ulist.js";
import { Slider } from "../layout/slider-2025.js";

// FORM COMPONENTS
import { FloatingInput } from "../layout/form-components/floating-input.js";
import { Range } from "../layout/form-components/range.js";
import { RadioGroup } from "../layout/form-components/radio.js";
import { Picker } from "../layout/form-components/picker.js";
import { FilePickera } from "../layout/form-components/image-picker.js";
import { DataList } from "../layout/form-components/data-list.js";
import { Form } from "../layout/form-components/form.js";
import { Button } from "../layout/button.js";

// LIBRARY HELPERS / ANIMATIONS
import { Des } from "../lib/designer.js";
import { LinkStyler } from "../lib/link-getter.js";
import { CardGen } from "../lib/card-getter.js";
import { KeyframeAnim } from "../lib/keyframe-animation.js";
import { TransformAnim } from "../lib/transform-anim.js";
import { Stacker } from "../lib/stacker.js";
import { ScrollVideo } from "../lib/scroll-video.js";

// SHAPES / MISC
import { AreaSwitcher } from "../layout/grid-switcher.js";
import { Polygon } from "../layout/polygon.js";
import { Circle } from "../layout/circle.js";

// Expose modules as globals
if (typeof window !== 'undefined') {
  window.ElementMapper = ElementMapper;
  window.Animator = Animator;
  window.Text = Text;
  window.Image = Image;
  window.Link = Link;
  window.FlexRow = FlexRow;
  window.UINavBar = UINavBar;
  window.Free = Free;
  window.Audio = Audio;
  window.Progress = Progress;
  window.Center = Center;
  window.Code = Code;
  window.Stack = Stack;
  window.Wrapper = Wrapper;
  window.MetaAdder = MetaAdder;
  window.Table = Table;
  window.Dropdown = Dropdown;
  window.Modal = Modal;
  window.TextField = TextField;
  window.Card = Card;
  window.Wrap = Wrap;
  window.FlexGrid = FlexGrid;
  window.ZoomCard = ZoomCard;
  window.CustomDivRenderer = CustomDivRenderer;
  window.SideBar = SideBar;
  window.SideNav = SideNav;
  window.SimpleBar = SimpleBar;
  window.DesktopBar = DesktopBar;
  window.MobileBar = MobileBar;
  window.Switcher = Switcher;
  window.Spacer = Spacer;
  window.HScroller = HScroller;
  window.Checkbox = Checkbox;
  window.Base = Base;
  window.FilePickera = FilePickera;
  window.Picker = Picker;
  window.Range = Range;
  window.RadioGroup = RadioGroup;
  window.DataList = DataList;
  window.Button = Button;
  window.Des = Des;
  window.LinkStyler = LinkStyler;
  window.CardGen = CardGen;
  window.KeyframeAnim = KeyframeAnim;
  window.TransformAnim = TransformAnim;
  window.Stacker = Stacker;
  window.ScrollVideo = ScrollVideo;
  window.AreaSwitcher = AreaSwitcher;
  window.Video = Video;
  window.UList = UList;
  window.Slider = Slider;
}

if (typeof global !== 'undefined') {
  global.ElementMapper = ElementMapper;
  global.Animator = Animator;
  global.Text = Text;
  global.Image = Image;
  global.Link = Link;
  global.FlexRow = FlexRow;
  global.UINavBar = UINavBar;
  global.Free = Free;
  global.Audio = Audio;
  global.Progress = Progress;
  global.Center = Center;
  global.Code = Code;
  global.Stack = Stack;
  global.Wrapper = Wrapper;
  global.MetaAdder = MetaAdder;
  global.Table = Table;
  global.Dropdown = Dropdown;
  global.Modal = Modal;
  global.TextField = TextField;
  global.Card = Card;
  global.Wrap = Wrap;
  global.FlexGrid = FlexGrid;
  global.ZoomCard = ZoomCard;
  global.CustomDivRenderer = CustomDivRenderer;
  global.SideBar = SideBar;
  global.SideNav = SideNav;
  global.SimpleBar = SimpleBar;
  global.DesktopBar = DesktopBar;
  global.MobileBar = MobileBar;
  global.Switcher = Switcher;
  global.Spacer = Spacer;
  global.HScroller = HScroller;
  global.Checkbox = Checkbox;
  global.Base = Base;
  global.FilePickera = FilePickera;
  global.Picker = Picker;
  global.Range = Range;
  global.RadioGroup = RadioGroup;
  global.DataList = DataList;
  global.Button = Button;
  global.Des = Des;
  global.LinkStyler = LinkStyler;
  global.CardGen = CardGen;
  global.KeyframeAnim = KeyframeAnim;
  global.TransformAnim = TransformAnim;
  global.Stacker = Stacker;
  global.ScrollVideo = ScrollVideo;
  global.AreaSwitcher = AreaSwitcher;
  global.Video = Video;
  global.UList = UList;
  global.Slider = Slider;
}

export {
  ElementMapper,
  Animator,
  Text,
  Image,
  Link,
  FlexRow,
  UINavBar,
  Free,
  Audio,
  Progress,
  Center,
  Code,
  Stack,
  Wrapper,
  MetaAdder,
  Table,
  Dropdown,
  Modal,
  TextField,
  Card,
  Wrap,
  FlexGrid,
  ZoomCard,
  CustomDivRenderer,
  SideBar,
  SideNav,
  SimpleBar,
  DesktopBar, 
  MobileBar,
  Switcher,
  Spacer,
  HScroller,
  Checkbox,
  Base,
  FilePickera,
  Picker,
  Range,
  RadioGroup,
  DataList,
  Button,
  Des,
  LinkStyler,
  CardGen,
  KeyframeAnim,
  TransformAnim,
  Stacker,
  ScrollVideo,
  AreaSwitcher,
  Video,
  UList,
  Slider
}; // 172112 Nice!!!! 17/04/25