package com.flashops.api.admin;

import com.flashops.api.domain.ParametresApplication;
import jakarta.mail.Message;
import jakarta.mail.Session;
import jakarta.mail.Transport;
import jakarta.mail.internet.InternetAddress;
import jakarta.mail.internet.MimeMessage;
import java.util.Properties;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class SmtpTestService {

  public void sendTest(ParametresApplication p, String to) {
    send(p, to, "Flash OPS — test SMTP", "Ceci est un message de test envoyé depuis Flash OPS.");
  }

  public void send(ParametresApplication p, String to, String subject, String text) {
    if (p.getSmtpHost() == null || p.getSmtpHost().isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "smtp host not configured");
    }
    if (p.getSmtpMotDePasse() == null || p.getSmtpMotDePasse().isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "smtp password not configured");
    }
    if (to == null || to.isBlank()) {
      throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "destinataire manquant");
    }
    try {
      Properties props = new Properties();
      props.put("mail.smtp.host", p.getSmtpHost());
      props.put("mail.smtp.port", String.valueOf(p.getSmtpPort()));
      props.put("mail.smtp.auth", "true");
      props.put("mail.smtp.connectiontimeout", "15000");
      props.put("mail.smtp.timeout", "15000");
      props.put("mail.smtp.writetimeout", "15000");
      String enc = p.getSmtpEncryption() == null ? "tls" : p.getSmtpEncryption().toLowerCase();
      if ("ssl".equals(enc)) {
        props.put("mail.smtp.ssl.enable", "true");
        props.put("mail.smtp.socketFactory.port", String.valueOf(p.getSmtpPort()));
        props.put("mail.smtp.socketFactory.class", "javax.net.ssl.SSLSocketFactory");
      } else if ("tls".equals(enc)) {
        props.put("mail.smtp.starttls.enable", "true");
      }
      Session session =
          Session.getInstance(
              props,
              new jakarta.mail.Authenticator() {
                @Override
                protected jakarta.mail.PasswordAuthentication getPasswordAuthentication() {
                  return new jakarta.mail.PasswordAuthentication(
                      p.getSmtpUsername(), p.getSmtpMotDePasse());
                }
              });
      MimeMessage message = new MimeMessage(session);
      String from =
          p.getSmtpFromEmail() != null && !p.getSmtpFromEmail().isBlank()
              ? p.getSmtpFromEmail()
              : p.getSmtpUsername();
      message.setFrom(new InternetAddress(from, p.getSmtpFromName(), "UTF-8"));
      message.setRecipients(Message.RecipientType.TO, InternetAddress.parse(to, false));
      message.setSubject(subject, "UTF-8");
      message.setText(text, "UTF-8");
      Transport.send(message);
    } catch (ResponseStatusException e) {
      throw e;
    } catch (Exception e) {
      throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "smtp send failed: " + e.getMessage());
    }
  }
}
