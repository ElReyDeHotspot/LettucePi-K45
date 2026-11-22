(function () {
	'use strict';
	if (document.body.dataset.page !== 'admin-network-wifi') return;

	function findCard(label) {
		var cards = document.querySelectorAll('.misectel-page--wifi .misectel-grid > .misectel-card, .misectel-page--wifi .misectel-grid > section');
		for (var i = 0; i < cards.length; i++)
			if ((cards[i].textContent || '').indexOf(label) >= 0) return cards[i];
		return null;
	}

	function el(tag, cls, text) {
		var n = document.createElement(tag);
		if (cls) n.className = cls;
		if (text != null) n.textContent = text;
		return n;
	}

	function add(uci, card, radio, maximum) {
		if (!card || card.querySelector('[data-wifi-txpower]')) return;
		var field = el('div', 'misectel-field wifi-txpower-field');
		var head = el('div', 'misectel-field__head');
		var control = el('div', 'misectel-field__control');
		var wrap = el('div', 'misectel-select-wrap');
		var select = el('select', 'misectel-select');
		var configured = uci.get('wireless', radio, 'txpower') || '';
		field.dataset.wifiTxpower = radio;
		head.appendChild(el('label', 'misectel-field__label', 'Transmit Power'));
		select.appendChild(new Option('Auto (driver default)', '', configured === '', configured === ''));
		for (var dbm = maximum; dbm >= 0; dbm--) {
			var mw = Math.round(Math.pow(10, dbm / 10));
			select.appendChild(new Option(dbm + ' dBm (' + mw + ' mW)', String(dbm), String(dbm) === String(configured), String(dbm) === String(configured)));
		}
		select.addEventListener('change', function () {
			if (select.value) uci.set('wireless', radio, 'txpower', select.value);
			else uci.unset('wireless', radio, 'txpower');
		});
		wrap.appendChild(select); control.appendChild(wrap); field.appendChild(head); field.appendChild(control);
		(card.querySelector('.misectel-card__body') || card).appendChild(field);
	}

	L.require('uci').then(function (uci) {
		return uci.load('wireless').then(function () {
			var attempts = 0;
			var timer = window.setInterval(function () {
				var card24 = findCard('2.4 GHz');
				var card58 = findCard('5.8 GHz');
				add(uci, card24, 'radio0', 25);
				add(uci, card58, 'radio1', 28);
				if ((card24 && card58) || ++attempts >= 40) window.clearInterval(timer);
			}, 250);
		});
	});
})();
