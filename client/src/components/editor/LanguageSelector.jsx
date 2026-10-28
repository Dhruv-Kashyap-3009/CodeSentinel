import { languages } from '../../utils/samples.js';

export default function LanguageSelector({ value, onChange }) {
  return <label className="control-group language-control"><span>LANGUAGE</span><select aria-label="Programming language" value={value} onChange={(event) => onChange(event.target.value)}>{languages.map((language) => <option key={language.id} value={language.id}>{language.label}</option>)}</select></label>;
}
